jest.mock('@iobroker/adapter-core', () => ({ Adapter: class {} }));
const NextcloudTalk = require('../main');
const axios = require('axios');
jest.mock('axios');

describe('NextcloudTalk adapter', () => {
    const createAdapter = () => ({
        namespace: 'nextcloudtalk.0',
        log: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
        getStateAsync: jest.fn().mockResolvedValue({ val: 'legacy-room' }),
        sendMessage: jest.fn().mockResolvedValue(),
        setObjectNotExists: jest.fn().mockResolvedValue(),
        subscribeStates: jest.fn(),
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('creates and subscribes to the new send state', async () => {
        const adapter = createAdapter();

        await NextcloudTalk.prototype.onReady.call(adapter);

        expect(adapter.setObjectNotExists).toHaveBeenCalledWith(
            'send',
            expect.objectContaining({ type: 'state', common: expect.objectContaining({ type: 'string', write: true }) }),
        );
        expect(adapter.subscribeStates).toHaveBeenCalledWith('text');
        expect(adapter.subscribeStates).toHaveBeenCalledWith('send');
    });

    test('send state selects a room without reading roomID', async () => {
        const adapter = createAdapter();

        await NextcloudTalk.prototype.onStateChange.call(adapter, 'nextcloudtalk.0.send', {
            val: JSON.stringify({ roomId: 'chosen-room', text: 'hello' }),
            ack: false,
        });

        expect(adapter.sendMessage).toHaveBeenCalledWith('chosen-room', 'hello');
        expect(adapter.getStateAsync).not.toHaveBeenCalled();
    });

    test('legacy text state still uses roomID', async () => {
        const adapter = createAdapter();

        await NextcloudTalk.prototype.onStateChange.call(adapter, 'nextcloudtalk.0.text', {
            val: 'legacy message',
            ack: false,
        });

        expect(adapter.getStateAsync).toHaveBeenCalledWith('roomID');
        expect(adapter.sendMessage).toHaveBeenCalledWith('legacy-room', 'legacy message');
    });

    test.each(['not json', '{}', '[]', '{"roomId":"","text":"hello"}', '{"roomId":"room","text":""}'])(
        'rejects invalid send command %s',
        async (value) => {
            const adapter = createAdapter();

            await NextcloudTalk.prototype.onStateChange.call(adapter, 'nextcloudtalk.0.send', {
                val: value,
                ack: false,
            });

            expect(adapter.sendMessage).not.toHaveBeenCalled();
            expect(adapter.log.warn).toHaveBeenCalled();
        },
    );

    test('ignores acknowledged and unrelated state changes', async () => {
        const adapter = createAdapter();

        await NextcloudTalk.prototype.onStateChange.call(adapter, 'nextcloudtalk.0.send', {
            val: JSON.stringify({ roomId: 'room', text: 'hello' }),
            ack: true,
        });
        await NextcloudTalk.prototype.onStateChange.call(adapter, 'nextcloudtalk.0.roomID', {
            val: 'room',
            ack: false,
        });

        expect(adapter.sendMessage).not.toHaveBeenCalled();
    });

    test('sendMessage posts to correct endpoint', async () => {
        const adapter = {
            config: { server: 'https://nc', username: 'user', token: 'token' },
            log: { debug: jest.fn(), error: jest.fn() },
        };
        await NextcloudTalk.prototype.sendMessage.call(adapter, 5, 'hello');
        expect(axios.post).toHaveBeenCalledWith(
            'https://nc/ocs/v2.php/apps/spreed/api/v1/chat/5',
            { message: 'hello', actorDisplayName: '', referenceId: '', replyTo: 0, silent: false },
            expect.objectContaining({ auth: { username: 'user', password: 'token' }, timeout: 10000 }),
        );
    });
});
