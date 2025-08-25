import test from 'tape';
import WorkerPool from '../index.js';
import Sinon from 'sinon';

test('Raster Conversion Test', async (t) => {
    const pool = new WorkerPool({
        api: 'http://localhost:5001',
        secret: 'coe-wildland-fire',
        bucket: 'test-bucket',
        interval: 1000
    });

    await pool.close();

    t.end();
});
