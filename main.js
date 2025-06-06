'use strict';
const utils = require('@iobroker/adapter-core');
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
            common: { type: 'number', role: 'value', name: 'Room ID', write: true, read: true },
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
        const url = `${server}/ocs/v2.php/apps/spreed/api/v4/rooms/${roomId}/message`;
        await axios.post(url, { message: text }, {
            headers: {
                'OCS-APIRequest': 'true'
            },
            auth: {
                username: username,
                password: token
            }
        });
    }
}

if (module.parent) {
    module.exports = (options) => new NextcloudTalk(options);
} else {
    new NextcloudTalk();
}
