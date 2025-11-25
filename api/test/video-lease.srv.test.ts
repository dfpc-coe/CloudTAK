import test from 'tape';
import Flight from './flight.js';
import { MockAgent, setGlobalDispatcher, getGlobalDispatcher } from 'undici';

const flight = new Flight();

flight.init();
flight.takeoff();
flight.user();

test('GET: api/video/lease - MediaServer Query', async (t) => {
    try {
        const res = await flight.fetch('/api/video/lease?impersonate=true&ephemeral=all', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        t.deepEquals(res.body, {
            total: 0,
            items: []
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test('POST: api/video/lease - Create Lease', async (t) => {
    const originalDispatcher = getGlobalDispatcher();
    const agent = new MockAgent();
    agent.disableNetConnect();
    agent.enableNetConnect('localhost:5001');
    setGlobalDispatcher(agent);

    const mediaClient = agent.get('http://media-server:9997');
    mediaClient.intercept({
        path: '/path',
        method: 'POST'
    }).reply(200, {});

    try {
        await flight.config!.models.Setting.generate({
            key: 'media::url',
            value: 'http://media-server'
        });

        const res = await flight.fetch('/api/video/lease', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                name: 'Test Lease',
                duration: 3600
            }
        }, true);

        t.equals(res.status, 200, 'Status 200');
        t.ok(res.body.id, 'Lease ID returned');
        t.equals(res.body.name, 'Test Lease', 'Name matches');
    } catch (err) {
        t.error(err, 'no error');
    }

    setGlobalDispatcher(originalDispatcher);
    await agent.close();
    t.end();
});

flight.landing();
