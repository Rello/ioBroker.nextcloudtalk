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
        setStateAsync: jest.fn().mockResolvedValue(),
        config: { receiveEnabled: false },
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

    test('receiving is optional and creates a read-only event state', async () => {
        const adapter = createAdapter();
        await NextcloudTalk.prototype.onReady.call(adapter);
        expect(adapter.setObjectNotExists).toHaveBeenCalledWith('received', expect.objectContaining({
            common: expect.objectContaining({ write: false, read: true }),
        }));
        expect(axios.get).not.toHaveBeenCalled();
    });

    test('initializes the cursor then publishes only new user messages without read markers', async () => {
        const adapter = createAdapter();
        adapter.config = { server: 'https://nc', username: 'bot', token: 'secret', receiveRoom: 'room' };
        adapter.getStateAsync.mockResolvedValue(null);
        adapter.receiveStopped = false;
        axios.get.mockResolvedValueOnce({ status: 200, data: { ocs: { data: [{ id: 10 }] } } });
        axios.get.mockImplementationOnce(async () => ({ status: 200, data: { ocs: { data: [
            { id: 11, messageType: 'comment', actorType: 'users', actorId: 'bot', message: 'own' },
            { id: 12, messageType: 'system', systemMessage: 'joined', actorId: 'other', message: 'system' },
            { id: 13, messageType: 'comment', systemMessage: '', actorType: 'users', actorId: 'alice',
                actorDisplayName: 'Alice', timestamp: 123, message: 'hello' },
        ] } } }));
        axios.get.mockImplementationOnce(async () => { adapter.receiveStopped = true; return { status: 304 }; });
        await NextcloudTalk.prototype.receiveLoop.call(adapter);
        expect(axios.get).toHaveBeenCalledWith('https://nc/ocs/v2.php/apps/spreed/api/v1/chat/room',
            expect.objectContaining({ params: expect.objectContaining({ setReadMarker: 0, markNotificationsAsRead: 0,
                noStatusUpdate: 1, lookIntoFuture: 0 }) }));
        expect(axios.get.mock.calls[1][1].params).toEqual(expect.objectContaining({ lookIntoFuture: 1,
            lastKnownMessageId: 10 }));
        const events = adapter.setStateAsync.mock.calls.filter(([id]) => id === 'received');
        expect(events).toHaveLength(1);
        expect(JSON.parse(events[0][1].val)).toEqual(expect.objectContaining({ roomId: 'room', id: 13,
            text: 'hello', actorId: 'alice' }));
        expect(events[0][1].ack).toBe(true);
    });
});
