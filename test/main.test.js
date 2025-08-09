const NextcloudTalk = require('../main');
const axios = require('axios');
jest.mock('axios');

describe('NextcloudTalk adapter', () => {
    test('sendMessage posts to correct endpoint', async () => {
        const adapter = {
            config: { server: 'https://nc', username: 'user', token: 'token' },
            log: { debug: jest.fn(), error: jest.fn() }
        };
        await NextcloudTalk.prototype.sendMessage.call(adapter, 5, 'hello');
        expect(axios.post).toHaveBeenCalledWith(
            'https://nc/ocs/v2.php/apps/spreed/api/v1/chat/5',
            { message: 'hello', actorDisplayName: '', referenceId: '', replyTo: 0, silent: false },
            expect.objectContaining({ auth: { username: 'user', password: 'token' }, timeout: 10000 })
        );
    });
});
