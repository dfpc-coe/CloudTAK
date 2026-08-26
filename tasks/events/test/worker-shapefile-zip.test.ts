import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import Sinon from 'sinon';
import { DataPackage } from '@tak-ps/node-cot';
import Worker from '../src/worker.js';
import type { LocalMessage } from '../src/types.js';

test('Worker DataPackage Import: Shapefile Sidecars are Ignored', async (t) => {
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
            name: 'import.zip',
            username: 'admin@example.com',
            source: 'Upload',
            config: {},
            source_id: null,
        },
    });

    const processFile = Sinon.stub(worker, 'processFile').resolves();
    const unlink = Sinon.stub(fs, 'unlinkSync');
    const destroy = Sinon.stub().resolves();

    const parse = Sinon.stub(DataPackage, 'parse').resolves({
        contents: [],
        path: '/tmp/fake-package',
        settings: { name: 'fake' },
        cots: async () => [],
        files: async () => new Set([
            'roads.shp',
            'roads.dbf',
            'roads.shx',
            'roads.prj',
            'notes.txt',
        ]),
        destroy,
    } as unknown as DataPackage);

    t.after(() => {
        parse.restore();
        processFile.restore();
        unlink.restore();
    });

    await worker.processArchive({
        id: 'archive-id',
        tmpdir: '/tmp/archive',
        ext: '.zip',
        name: 'import.zip',
        raw: '/tmp/archive/import.zip',
    } as LocalMessage);

    assert.equal(unlink.callCount, 1);
    assert.deepEqual(processFile.getCalls().map((call) => {
        const local = call.args[0] as LocalMessage;
        return {
            tmpdir: local.tmpdir,
            ext: local.ext,
            name: local.name,
            raw: local.raw,
        };
    }), [{
        tmpdir: '/tmp/fake-package',
        ext: '.shp',
        name: 'roads.shp',
        raw: '/tmp/fake-package/raw/roads.shp',
    }, {
        tmpdir: '/tmp/fake-package',
        ext: '.txt',
        name: 'notes.txt',
        raw: '/tmp/fake-package/raw/notes.txt',
    }]);
    assert.equal(destroy.callCount, 1);
});
