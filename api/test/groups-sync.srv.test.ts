import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';
import type { IncomingMessage, ServerResponse } from 'node:http';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();

function mockGroups(groups: Array<{
    name: string;
    direction: string;
    type: string;
    bitpos: number;
    description?: string;
}>): void {
    flight.tak.mockMarti.unshift(async (request: IncomingMessage, response: ServerResponse) => {
        if (!request.method || !request.url) {
            return false;
        } else if (request.method === 'GET' && request.url === '/Marti/api/groups/all?useCache=true') {
            response.setHeader('Content-Type', 'application/json');
            response.write(JSON.stringify({
                version: '3',
                type: 'com.bbn.marti.remote.groups.Group',
                data: groups.map((group) => {
                    return {
                        created: '2025-06-26T16:51:41.028Z',
                        active: true,
                        ...group,
                    };
                }),
            }));
            response.end();

            return true;
        } else {
            return false;
        }
    });
}

let created = '';

test('Groups Sync: Populate Channels', async () => {
    try {
        // The same Group is returned once per direction - ensure IN/OUT are deduped
        mockGroups([
            { name: 'MESA - FIRE', direction: 'IN', type: 'SYSTEM', bitpos: 2, description: 'Mesa County Fire' },
            { name: 'MESA - FIRE', direction: 'OUT', type: 'SYSTEM', bitpos: 2, description: 'Mesa County Fire' },
            { name: '__ANON__', direction: 'OUT', type: 'SYSTEM', bitpos: 0 },
        ]);

        await flight.stateful!.groups.sync();

        const list = await flight.stateful!.models.Channel.list();
        const channels = list.items.sort((a, b) => a.bitpos - b.bitpos);

        assert.equal(list.total, 2);
        assert.equal(channels[0].bitpos, 0);
        assert.equal(channels[0].name, '__ANON__');
        assert.equal(channels[0].type, 'SYSTEM');
        assert.equal(channels[0].description, '');
        assert.equal(channels[1].bitpos, 2);
        assert.equal(channels[1].name, 'MESA - FIRE');
        assert.equal(channels[1].type, 'SYSTEM');
        assert.equal(channels[1].description, 'Mesa County Fire');

        created = channels[1].created;
    } catch (err) {
        assert.ifError(err);
    }

    flight.tak.reset();
});

test('Groups Sync: Update & Prune Channels', async () => {
    try {
        mockGroups([
            { name: 'MESA - FIRE', direction: 'OUT', type: 'SYSTEM', bitpos: 2, description: 'Updated Description' },
            { name: 'MESA - EMS', direction: 'OUT', type: 'SYSTEM', bitpos: 3, description: 'Mesa County EMS' },
        ]);

        await flight.stateful!.groups.sync();

        const list = await flight.stateful!.models.Channel.list();
        const channels = list.items.sort((a, b) => a.bitpos - b.bitpos);

        assert.equal(list.total, 2);
        assert.equal(channels[0].bitpos, 2);
        assert.equal(channels[0].name, 'MESA - FIRE');
        assert.equal(channels[0].description, 'Updated Description');
        assert.equal(channels[1].bitpos, 3);
        assert.equal(channels[1].name, 'MESA - EMS');
        assert.equal(channels[1].description, 'Mesa County EMS');

        // Updating an existing Channel must preserve its original created timestamp
        assert.equal(channels[0].created, created);
    } catch (err) {
        assert.ifError(err);
    }

    flight.tak.reset();
});

test('Groups Sync: Empty response leaves Channels untouched', async () => {
    try {
        mockGroups([]);

        await flight.stateful!.groups.sync();

        const list = await flight.stateful!.models.Channel.list();

        assert.equal(list.total, 2);
    } catch (err) {
        assert.ifError(err);
    }

    flight.tak.reset();
});

flight.landing();
