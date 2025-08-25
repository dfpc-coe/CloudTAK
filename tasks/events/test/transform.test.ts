import test from 'tape';
import type { ImportList } from '../src/types.js';
import WorkerPool from '../index.js';
import Sinon from 'sinon';
import { MockAgent, setGlobalDispatcher, getGlobalDispatcher } from 'undici';
import type { Dispatcher } from 'undici';

test('Raster Conversion Test', async (t) => {
    const mockAgent = new MockAgent();
    const originalDispatcher = getGlobalDispatcher();

    mockAgent.disableNetConnect();

    setGlobalDispatcher(mockAgent);

    const mockPool = mockAgent.get('http://localhost:5001');

    // Mock global config endpoint
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
                    mode: 'Unknown',
                    config: {},
                    mode_id: null,
                }]
            } as ImportList)
        };
    });

    const pool = new WorkerPool({
        api: 'http://localhost:5001',
        secret: 'coe-wildland-fire',
        bucket: 'test-bucket',
        interval: 1000,
        maxWorkers: 1
    });

    /**
    await pool.close();

    setGlobalDispatcher(originalDispatcher);
    mockAgent.close();

    t.end();
    */
});
