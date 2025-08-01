"use strict";
let utils;
if (process.env.NODE_ENV === 'test') {
    utils = { Adapter: class {} };
} else {
    utils = require('@iobroker/adapter-core');
}
const axios = require('axios');

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
            native: {}
        });
        await this.setObjectNotExists('text', {
            type: 'state',
            common: { type: 'string', role: 'text', name: 'Message text', write: true, read: true },
            native: {}
        });
        this.subscribeStates('text');
    }

    async onStateChange(id, state) {
        if (!state || state.ack || !id.endsWith('text')) return;
        try {
            const roomIdState = await this.getStateAsync('roomID');
            const roomId = roomIdState ? roomIdState.val : null;
            if (!roomId) {
                this.log.warn('roomID not set');
                return;
            }
            await this.sendMessage(roomId, state.val);
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
                    'OCS-APIRequest': 'true'
                },
                auth: {
                    username: username,
                    password: token
                }
            });
        } catch (error) {
            if (error.response) {
                this.log.error(`POST ${error.response.config.url} failed with ${error.response.status}: ${JSON.stringify(error.response.data)}`);
            } else {
                this.log.error(`Request error: ${error.message}`);
            }
            throw error;
        }
    }
}

if (module.parent) {
    module.exports = NextcloudTalk;
} else {
    new NextcloudTalk();
}
