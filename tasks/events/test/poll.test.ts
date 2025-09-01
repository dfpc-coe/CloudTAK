import test from 'tape';
import type { ImportList } from '../src/types.js';
import WorkerPool from '../index.js';
import { MockAgent, setGlobalDispatcher, getGlobalDispatcher } from 'undici';

test('Ensure Poll Triggers Job', async (t) => {
    const mockAgent = new MockAgent();
    const originalDispatcher = getGlobalDispatcher();

    mockAgent.disableNetConnect();

    setGlobalDispatcher(mockAgent);

    const mockPool = mockAgent.get('http://localhost:5001');

    mockPool.intercept({
        path: '/api/import?limit=1&status=Pending',
        method: 'GET'
    }).reply(() => {
        return {
            statusCode: 200,
            data: JSON.stringify({
                total: 1,
                items: [{
                    id: 'ba58a298-a3fe-46b4-a29a-9dd33fbb2139',
                    created: '2025-08-25T18:08:21.563Z',
                    updated: '2025-08-25T18:08:21.563Z',
                    status: 'Pending',
                    error: null,
                    result: {},
                    name: 'import.kml',
                    username: 'admin@example.com',
                    source: 'Upload',
                    source_id: null,
                    config: {},
                }]
            } as ImportList)
        };
    });

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
                id: 'ba58a298-a3fe-46b4-a29a-9dd33fbb2139',
                created: '2025-08-25T18:08:21.563Z',
                updated: '2025-08-25T18:08:21.563Z',
                status: 'Running',
                error: null,
                result: {},
                name: 'import.kml',
                username: 'admin@example.com',
                source: 'Upload',
                source_id: null,
                config: {},
            } as Import)
        };
    });

    const pool = new WorkerPool({
        api: 'http://localhost:5001',
        secret: 'coe-wildland-fire',
        bucket: 'test-bucket',
        interval: 1000,
        maxWorkers: 1
    });

    return new Promise((resolve) => {
        pool.on('job', async (job) => {
            t.deepEquals(job, {
                id: 'ba58a298-a3fe-46b4-a29a-9dd33fbb2139',
                created: '2025-08-25T18:08:21.563Z',
                updated: '2025-08-25T18:08:21.563Z',
                status: 'Running',
                error: null,
                result: {},
                name: 'import.kml',
                username: 'admin@example.com',
                source: 'Upload',
                config: {},
                source_id: null,
            });

            await pool.close();
            setGlobalDispatcher(originalDispatcher);
            mockAgent.close();

            return resolve();
        });
})
});
