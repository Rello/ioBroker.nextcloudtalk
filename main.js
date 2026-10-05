'use strict';
const utils = require('@iobroker/adapter-core');
const axios = require('axios');
const AXIOS_TIMEOUT = 10000;
const RECEIVE_TIMEOUT = 35000;
const RETRY_DELAY = 5000;

class NextcloudTalk extends utils.Adapter {
    constructor(options) {
        super({ ...options, name: 'nextcloudtalk' });
        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        this.on('unload', this.onUnload.bind(this));
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
        await this.setObjectNotExists('received', {
            type: 'state',
            common: { type: 'string', role: 'json', name: 'Last received message', write: false, read: true },
            native: {},
        });
        await this.setObjectNotExists('receiveCursor', {
            type: 'state',
            common: { type: 'string', role: 'json', name: 'Receive cursor', write: false, read: true },
            native: {},
        });
        this.subscribeStates('text');
        this.subscribeStates('send');
        if (this.config?.receiveEnabled) {
            if (typeof this.config.receiveRoom !== 'string' || !this.config.receiveRoom.trim()) {
                this.log.warn('Receiving is enabled but no Talk room token is configured');
            } else {
                this.receiveStopped = false;
                this.receiveLoop().catch(error => this.log.error(`Receive loop stopped: ${error.message}`));
            }
        }
    }

    onUnload(callback) {
        this.receiveStopped = true;
        this.receiveAbort?.abort();
        if (this.receiveTimer) {
            this.clearTimeout(this.receiveTimer);
        }
        this.receiveRetryResolve?.(undefined);
        callback();
    }

    async receiveLoop() {
        const roomId = this.config.receiveRoom.trim();
        let cursor;
        try {
            const state = await this.getStateAsync('receiveCursor');
            const saved = typeof state?.val === 'string' ? JSON.parse(state.val) : null;
            if (saved?.roomId === roomId && Number.isSafeInteger(saved.messageId) && saved.messageId >= 0) {
                cursor = saved.messageId;
            }
        } catch (error) {
            this.log.warn(`Could not load receive cursor: ${error.message}`);
        }
        while (!this.receiveStopped) {
            try {
                this.receiveAbort = new AbortController();
                const response = await axios.get(
                    `${this.config.server}/ocs/v2.php/apps/spreed/api/v1/chat/${encodeURIComponent(roomId)}`,
                    {
                        params: {
                            lookIntoFuture: cursor === undefined ? 0 : 1,
                            lastKnownMessageId: cursor,
                            limit: cursor === undefined ? 1 : 100,
                            timeout: 30,
                            setReadMarker: 0,
                            markNotificationsAsRead: 0,
                            noStatusUpdate: 1,
                        },
                        headers: { 'OCS-APIRequest': 'true', Accept: 'application/json' },
                        auth: { username: this.config.username, password: this.config.token },
                        timeout: RECEIVE_TIMEOUT,
                        signal: this.receiveAbort.signal,
                        validateStatus: status => status === 200 || status === 304,
                    },
                );
                if (response.status === 304) {
                    continue;
                }
                const messages = response.data?.ocs?.data;
                if (!Array.isArray(messages)) {
                    throw new Error('Invalid Talk chat response');
                }
                const previousCursor = cursor;
                for (const message of messages.sort((a, b) => a.id - b.id)) {
                    if (
                        this.receiveStopped ||
                        !Number.isSafeInteger(message.id) ||
                        (cursor !== undefined && message.id <= cursor)
                    ) {
                        continue;
                    }
                    if (
                        previousCursor !== undefined &&
                        message.messageType === 'comment' &&
                        !message.systemMessage &&
                        !(message.actorType === 'users' && message.actorId === this.config.username)
                    ) {
                        await this.setStateAsync('received', {
                            val: JSON.stringify({
                                roomId,
                                id: message.id,
                                text: message.message,
                                actorId: message.actorId,
                                actorDisplayName: message.actorDisplayName,
                                timestamp: message.timestamp,
                                messageType: message.messageType,
                            }),
                            ack: true,
                        });
                    }
                    cursor = message.id;
                    await this.setStateAsync('receiveCursor', {
                        val: JSON.stringify({ roomId, messageId: cursor }),
                        ack: true,
                    });
                }
                if (cursor === undefined) {
                    cursor = 0;
                    await this.setStateAsync('receiveCursor', {
                        val: JSON.stringify({ roomId, messageId: cursor }),
                        ack: true,
                    });
                }
            } catch (error) {
                if (this.receiveStopped) {
                    break;
                }
                this.log.warn(`Talk receive request failed: ${error.message}`);
                await new Promise(resolve => {
                    this.receiveRetryResolve = resolve;
                    this.receiveTimer = this.setTimeout(() => resolve(undefined), RETRY_DELAY);
                });
                this.receiveTimer = undefined;
                this.receiveRetryResolve = undefined;
            } finally {
                this.receiveAbort = undefined;
            }
        }
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
