'use strict';
const utils = require('@iobroker/adapter-core');
const axios = require('axios');
const AXIOS_TIMEOUT = 10000;

class NextcloudTalk extends utils.Adapter {
    constructor(options) {
        super({ ...options, name: 'nextcloudtalk' });
        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
    }

    async onReady() {
        await this.setObjectNotExists('roomID', {
            type: 'state',
            common: { type: 'string', role: 'value', name: 'Room ID', write: true, read: true },
            native: {},
        });
        await this.setObjectNotExists('text', {
            type: 'state',
            common: { type: 'string', role: 'text', name: 'Message text', write: true, read: true },
            native: {},
        });
        await this.setObjectNotExists('send', {
            type: 'state',
            common: { type: 'string', role: 'json', name: 'Send message', write: true, read: true },
            native: {},
        });
        this.subscribeStates('text');
        this.subscribeStates('send');
    }

    async onStateChange(id, state) {
        if (!state || state.ack) {
            return;
        }
        try {
            let roomId;
            let text;
            if (id === `${this.namespace}.send`) {
                let command;
                try {
                    command = JSON.parse(state.val);
                } catch {
                    this.log.warn('Invalid send command: expected JSON with roomId and text');
                    return;
                }
                if (
                    !command ||
                    typeof command !== 'object' ||
                    Array.isArray(command) ||
                    typeof command.roomId !== 'string' ||
                    !command.roomId.trim() ||
                    typeof command.text !== 'string' ||
                    !command.text.trim()
                ) {
                    this.log.warn('Invalid send command: roomId and text must be non-empty strings');
                    return;
                }
                roomId = command.roomId;
                text = command.text;
            } else if (id === `${this.namespace}.text`) {
                const roomIdState = await this.getStateAsync('roomID');
                roomId = roomIdState ? roomIdState.val : null;
                if (!roomId) {
                    this.log.warn('roomID not set');
                    return;
                }
                text = state.val;
            } else {
                return;
            }
            await this.sendMessage(roomId, text);
            this.log.info(`Sent message to room ${roomId}`);
        } catch (err) {
            this.log.error(`Error sending message: ${err.message}`);
        }
    }

    async sendMessage(roomId, text) {
        const server = this.config.server;
        const username = this.config.username;
        const token = this.config.token;
        const url = `${server}/ocs/v2.php/apps/spreed/api/v1/chat/${roomId}`;
        const body = { message: text, actorDisplayName: '', referenceId: '', replyTo: 0, silent: false };
        this.log.debug(`Sending POST request to ${url} with body: ${JSON.stringify(body)}`);
        try {
            await axios.post(url, body, {
                headers: {
                    'OCS-APIRequest': 'true',
                },
                auth: {
                    username: username,
                    password: token,
                },
                timeout: AXIOS_TIMEOUT,
            });
        } catch (error) {
            if (error.response) {
                this.log.error(
                    `POST ${error.response.config.url} failed with ${error.response.status}: ${JSON.stringify(error.response.data)}`,
                );
            } else {
                this.log.error(`Request error: ${error.message}`);
            }
            throw error;
        }
    }
}

if (require.main === module) {
    new NextcloudTalk();
} else {
    module.exports = NextcloudTalk;
}
