import test from 'tape';
import type { ImportList } from '../src/types.js';
import Worker from '../src/worker.js';
import { MockAgent, setGlobalDispatcher, getGlobalDispatcher } from 'undici';
import type { Dispatcher } from 'undici';

test('Worker: KML Job', async (t) => {
    const mockAgent = new MockAgent();
    const originalDispatcher = getGlobalDispatcher();

    mockAgent.disableNetConnect();

    setGlobalDispatcher(mockAgent);

    const mockPool = mockAgent.get('http://localhost:5001');

    mockPool.intercept({
        path: '/api/import/ba58a298-a3fe-46b4-a29a-9dd33fbb2139',
        method: 'PATCH',
        body: JSON.stringify({
            status: 'Running'
        })
    }).reply(() => {
        return {
            statusCode: 200,
            data: JSON.stringify({
            } as Import)
        };
    });

    const worker = new Worker({
        api: 'http://localhost:5001',
        secret: 'coe-wildland-fire',
        bucket: 'test-bucket',
        job: {
            id: 'ba58a298-a3fe-46b4-a29a-9dd33fbb2139',
            created: '2025-08-25T18:08:21.563Z',
            updated: '2025-08-25T18:08:21.563Z',
            status: 'Running',
            error: null,
            result: {},
            name: 'import.kml',
            username: 'admin@example.com',
            mode: 'Unknown',
            config: {},
            mode_id: null,
        }
    });

    worker.on('error', (err) => {
        t.error(err);
    });

    worker.on('success', (err) => {
        t.end()
    });

    await worker.process()
});
