const NextcloudTalk = require('../main');
const axios = require('axios');
jest.mock('axios');

describe('NextcloudTalk adapter', () => {
    test('sendMessage posts to correct endpoint', async () => {
        const adapter = new NextcloudTalk({});
        adapter.config = { server: 'https://nc', username: 'user', token: 'token' };
        await adapter.sendMessage(5, 'hello');
        expect(axios.post).toHaveBeenCalledWith(
            'https://nc/ocs/v2.php/apps/spreed/api/v4/rooms/5/message',
            { message: 'hello' },
            expect.objectContaining({ auth: { username: 'user', password: 'token' } })
        );
    });
});
