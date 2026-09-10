process.env.SigningSecret = 'coe-wildland-fire';
import test from 'node:test';
import assert from 'node:assert';
import os from 'node:os';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import Sinon from 'sinon';
import Flight from './flight.js';
import { DataPackage } from '@tak-ps/node-cot';
import S3 from '../common/aws/s3.js';
import stream2buffer from '../stateless/lib/stream.js';
import type { IncomingMessage, ServerResponse } from 'node:http';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();

test('GET: api/marti/missions/:guid/cot - Invalid CoTs are isolated from valid Features', async () => {
    flight.tak.mockMarti.push(async (request: IncomingMessage, response: ServerResponse) => {
        if (!request.method || !request.url) return false;

        const url = new URL(request.url, 'http://localhost');

        if (request.method === 'GET' && url.pathname === '/Marti/api/missions/Test%20Mission/cot') {
            response.setHeader('Content-Type', 'application/xml');
            response.write(`
                <events>
                    <event version="2.0" uid="uid-valid" type="a-f-G" time="2026-08-11T00:00:00.000Z" start="2026-08-11T00:00:00.000Z" stale="2026-08-11T00:05:00.000Z" how="h-g-i-g-o">
                        <point lat="1.1" lon="2.2" hae="0.0" ce="9999999.0" le="9999999.0"/>
                        <detail>
                            <contact callsign="ALPHA"/>
                        </detail>
                    </event>
                    <event version="2.0" uid="uid-poisoned" type="a-f-G" time="2026-08-11T00:00:00.000Z" start="2026-08-11T00:00:00.000Z" stale="2026-08-11T00:05:00.000Z" how="h-g-i-g-o">
                        <detail>
                            <contact callsign="BRAVO"/>
                        </detail>
                    </event>
                </events>
            `);
            response.end();
            return true;
        }

        return false;
    });

    try {
        const res = await flight.fetch('/api/marti/missions/Test Mission/cot', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
            headers: {
                missionauthorization: 'test-mission-token',
            },
        }, true);

        assert.equal(res.body.type, 'FeatureCollection');

        assert.equal(res.body.features.length, 1);
        assert.equal(res.body.features[0].id, 'uid-valid');
        assert.equal(res.body.features[0].properties.callsign, 'ALPHA');

        assert.equal(res.body.invalid.length, 1);
        assert.equal(res.body.invalid[0].id, 'uid-poisoned');
        assert.equal(res.body.invalid[0].callsign, 'BRAVO');
        assert.ok(res.body.invalid[0].error.length > 0);
    } catch (err) {
        assert.ifError(err);
    } finally {
        flight.tak.reset();
    }
});

const GUID = 'c2a3d0f1-7b1e-4b0a-9c1d-1f2e3a4b5c6d';
const NAME = 'Test Mission';
const PACKAGE_PATH = `/Marti/api/missions/${encodeURIComponent(NAME)}/contents/missionpackage`;

function feature(id: string, props: Record<string, unknown> = {}) {
    return {
        id,
        type: 'Feature',
        properties: {
            type: 'a-f-G',
            how: 'h-g-i-g-o',
            callsign: 'ALPHA',
            time: '2026-08-11T00:00:00.000Z',
            start: '2026-08-11T00:00:00.000Z',
            stale: '2026-08-11T00:05:00.000Z',
            ...props,
        },
        geometry: { type: 'Point', coordinates: [2.2, 1.1] },
    };
}

function missionResponse(uids: string[]) {
    return JSON.stringify({
        version: '3',
        type: 'com.bbn.marti.sync.model.Mission',
        data: [{
            name: NAME,
            guid: GUID,
            description: '',
            chatRoom: '',
            baseLayer: '',
            bbox: '',
            path: '',
            classification: '',
            tool: 'public',
            keywords: [],
            creatorUid: 'ANDROID-CloudTAK-admin@example.com',
            createTime: '2024-01-01T00:00:00Z',
            externalData: [],
            feeds: [],
            mapLayers: [],
            inviteOnly: false,
            expiration: -1,
            uids: uids.map(uid => ({ data: uid, timestamp: '2024-01-01T00:00:00Z' })),
            contents: [],
            passwordProtected: false,
        }],
    });
}

/**
 * Mock the TAK Server calls behind a mission package upload
 *
 * @param opts.changes - contentUids reported by the package upload response
 * @param opts.uids - UIDs the mission reports on a subsequent GET
 */
function mockMission(opts: {
    changes: string[];
    uids: string[];
}) {
    const calls = {
        gets: 0,
        uploads: [] as Array<{ url: URL; headers: IncomingMessage['headers']; entries: string[] }>,
    };

    flight.tak.mockMarti.push(async (request: IncomingMessage, response: ServerResponse) => {
        if (!request.method || !request.url) return false;

        const url = new URL(request.url, 'http://localhost');

        if (request.method === 'GET' && url.pathname === `/Marti/api/missions/guid/${GUID}`) {
            calls.gets++;
            response.setHeader('Content-Type', 'application/json');
            response.write(missionResponse(opts.uids));
            response.end();
            return true;
        } else if (request.method === 'PUT' && url.pathname === PACKAGE_PATH) {
            const packagePath = path.resolve(os.tmpdir(), randomUUID() + '.zip');
            await fsp.writeFile(packagePath, await stream2buffer(request));
            const dp = await DataPackage.parse(packagePath);
            calls.uploads.push({
                url,
                headers: request.headers,
                entries: dp.contents.map(c => c._attributes.zipEntry),
            });
            await dp.destroy();
            await fsp.rm(packagePath, { force: true });

            response.setHeader('Content-Type', 'application/json');
            response.write(JSON.stringify({
                version: '3',
                type: 'MissionChange',
                data: opts.changes.map(contentUid => ({ type: 'ADD_CONTENT', contentUid })),
            }));
            response.end();
            return true;
        }

        return false;
    });

    return calls;
}

test('PUT: api/marti/missions/:guid/cot - Uploads a Mission Package and confirms from the change list', async () => {
    const calls = mockMission({ changes: ['uid-1', 'uid-2'], uids: [] });

    try {
        const res = await flight.fetch(`/api/marti/missions/${GUID}/cot`, {
            method: 'PUT',
            auth: {
                bearer: flight.token.admin,
            },
            headers: {
                missionauthorization: 'test-mission-token',
            },
            body: {
                features: [feature('uid-1'), feature('uid-2')],
            },
        }, true);

        assert.deepEqual(res.body, {
            status: 200,
            message: 'CoTs Submitted',
            uids: ['uid-1', 'uid-2'],
        });

        // One GET resolves the guid to the mission name - no confirmation GET was needed
        assert.equal(calls.gets, 1);
        assert.equal(calls.uploads.length, 1);
        assert.equal(calls.uploads[0].url.searchParams.get('creatorUid'), 'ANDROID-CloudTAK-admin@example.com');
        assert.equal(calls.uploads[0].headers['missionauthorization'], 'Bearer test-mission-token');
        assert.equal(calls.uploads[0].entries.length, 2);
        assert.ok(calls.uploads[0].entries.every(e => e.endsWith('.cot')));
    } catch (err) {
        assert.ifError(err);
    } finally {
        flight.tak.reset();
    }
});

test('PUT: api/marti/missions/:guid/cot - Falls back to the Mission UID list when no changes are reported', async () => {
    const calls = mockMission({ changes: [], uids: ['uid-1'] });

    try {
        const res = await flight.fetch(`/api/marti/missions/${GUID}/cot`, {
            method: 'PUT',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                features: [feature('uid-1')],
            },
        }, true);

        assert.deepEqual(res.body.uids, ['uid-1']);
        assert.equal(calls.gets, 2);
    } catch (err) {
        assert.ifError(err);
    } finally {
        flight.tak.reset();
    }
});

test('PUT: api/marti/missions/:guid/cot - Unconfirmed CoT is a 502', async () => {
    mockMission({ changes: ['uid-1'], uids: ['uid-1'] });

    try {
        const res = await flight.fetch(`/api/marti/missions/${GUID}/cot`, {
            method: 'PUT',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                features: [feature('uid-1'), feature('uid-2')],
            },
        }, false);

        assert.equal(res.status, 502);
        assert.equal(res.body.message, 'TAK Server did not confirm CoT: uid-2');
    } catch (err) {
        assert.ifError(err);
    } finally {
        flight.tak.reset();
    }
});

test('PUT: api/marti/missions/:guid/cot - Attachments are uploaded and attached before the package', async () => {
    const order: string[] = [];
    let attachedHashes: string[] | undefined;

    Sinon.stub(S3, 'list').resolves([{
        Key: 'attachment/att-hash/photo.jpg',
        Size: 9,
        LastModified: new Date(),
        ETag: '"abc"',
    }]);
    Sinon.stub(S3, 'get').resolves(Readable.from([Buffer.from('jpg-bytes')]));

    flight.tak.mockMarti.push(async (request: IncomingMessage, response: ServerResponse) => {
        if (!request.method || !request.url) return false;

        const url = new URL(request.url, 'http://localhost');

        if (request.method === 'POST' && url.pathname === '/Marti/sync/upload') {
            order.push('attachment-upload');
            assert.equal(url.searchParams.get('name'), 'photo.jpg');
            assert.equal((await stream2buffer(request)).toString(), 'jpg-bytes');

            response.setHeader('Content-Type', 'text/plain');
            response.write(JSON.stringify({
                UID: 'att-uid',
                SubmissionDateTime: new Date().toISOString(),
                Keywords: [],
                MIMEType: 'image/jpeg',
                SubmissionUser: 'admin@example.com',
                PrimaryKey: 'att-primary',
                Hash: 'att-tak-hash',
                CreatorUid: 'admin',
                Name: 'photo.jpg',
            }));
            response.end();
            return true;
        } else if (request.method === 'PUT' && url.pathname === `/Marti/api/missions/guid/${GUID}/contents`) {
            order.push('attach-contents');
            attachedHashes = JSON.parse(String(await stream2buffer(request))).hashes;

            response.setHeader('Content-Type', 'application/json');
            response.write(missionResponse([]));
            response.end();
            return true;
        } else if (request.method === 'PUT' && url.pathname === PACKAGE_PATH) {
            order.push('mission-package');
        }

        return false;
    });

    const calls = mockMission({ changes: ['uid-1'], uids: [] });

    try {
        const res = await flight.fetch(`/api/marti/missions/${GUID}/cot`, {
            method: 'PUT',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                features: [feature('uid-1', { attachments: ['att-hash'] })],
            },
        }, true);

        assert.deepEqual(res.body.uids, ['uid-1']);
        assert.deepEqual(attachedHashes, ['att-tak-hash']);
        // The file must be in the Mission before the CoT so clients can resolve the attachment_list hash
        assert.deepEqual(order, ['attachment-upload', 'attach-contents', 'mission-package']);
        // TAK Server ignores the manifest, so the mission package carries only the CoT
        assert.deepEqual(calls.uploads[0].entries.filter(e => !e.endsWith('.cot')), []);
    } catch (err) {
        assert.ifError(err);
    } finally {
        Sinon.restore();
        flight.tak.reset();
    }
});

flight.landing();
