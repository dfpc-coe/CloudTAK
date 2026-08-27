import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import Sinon from 'sinon';
import { DataPackage } from '@tak-ps/node-cot';
import Worker from '../src/worker.js';
import type { LocalMessage } from '../src/types.js';

test('Worker DataPackage Import: Geodatabase is processed as one dataset', async (t) => {
    const worker = new Worker({
        api: 'http://localhost:5001',
        secret: 'test-secret',
        bucket: 'test-bucket',
        job: {
            id: 'ba58a298-a3fe-46b4-a29a-9dd33fbb2139',
            created: '2025-08-25T18:08:21.563Z',
            updated: '2025-08-25T18:08:21.563Z',
            status: 'Running',
            error: null,
            result: {},
            name: 'geodatabase.zip',
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
            'transport.gdb/a00000001.gdbtable',
            'transport.gdb/a00000001.gdbtablx',
            'transport.gdb/gdb',
        ]),
        destroy,
    } as unknown as DataPackage);

    t.after(() => Sinon.restore());

    const archive = {
        id: 'archive-id',
        tmpdir: '/tmp/archive',
        ext: '.zip',
        name: 'geodatabase.zip',
        raw: '/tmp/archive/geodatabase.zip',
    } as LocalMessage;
    await worker.processArchive(archive);

    assert.equal(processFile.callCount, 1);
    assert.strictEqual(processFile.firstCall.args[0], archive);
    assert.deepEqual(processFile.firstCall.args[1], {
        id: processFile.firstCall.args[1].id,
        tmpdir: '/tmp/fake-package',
        ext: '.gdb',
        name: 'transport.gdb',
        raw: '/tmp/fake-package/raw/transport.gdb',
    });
    assert.equal(unlink.callCount, 1);
    assert.equal(destroy.callCount, 1);
    parse.restore();
});

test('Worker DataPackage Import: Flattened Geodatabase is processed as one dataset', async (t) => {
    const worker = new Worker({
        api: 'http://localhost:5001',
        secret: 'test-secret',
        bucket: 'test-bucket',
        job: {
            id: 'ba58a298-a3fe-46b4-a29a-9dd33fbb2139',
            created: '2025-08-25T18:08:21.563Z',
            updated: '2025-08-25T18:08:21.563Z',
            status: 'Running',
            error: null,
            result: {},
            name: 'boulder.zip',
            username: 'admin@example.com',
            source: 'Upload',
            config: {},
            source_id: null,
        },
    });

    const processFile = Sinon.stub(worker, 'processFile').resolves();
    Sinon.stub(fs, 'unlinkSync');
    const symlink = Sinon.stub(fs, 'symlinkSync');
    Sinon.stub(DataPackage, 'parse').resolves({
        contents: [],
        path: '/tmp/fake-package',
        settings: { name: 'fake' },
        cots: async () => [],
        files: async () => new Set([
            'a00000001.gdbtable',
            'a00000001.gdbtablx',
            'gdb',
            'timestamps',
        ]),
        destroy: Sinon.stub().resolves(),
    } as unknown as DataPackage);

    t.after(() => Sinon.restore());

    const archive = {
        id: 'archive-id',
        tmpdir: '/tmp/archive',
        ext: '.zip',
        name: 'boulder.zip',
        raw: '/tmp/archive/boulder.zip',
    } as LocalMessage;
    await worker.processArchive(archive);

    assert.equal(processFile.callCount, 1);
    assert.strictEqual(processFile.firstCall.args[0], archive);
    assert.deepEqual(processFile.firstCall.args[1], {
        id: processFile.firstCall.args[1].id,
        tmpdir: '/tmp/fake-package',
        ext: '.gdb',
        name: 'boulder.gdb',
        raw: '/tmp/fake-package/boulder.gdb',
    });
    assert.ok(symlink.calledOnceWithExactly(
        '/tmp/fake-package/raw',
        '/tmp/fake-package/boulder.gdb',
        'dir',
    ));
});
