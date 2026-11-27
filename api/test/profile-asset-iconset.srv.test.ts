import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';
import Sinon from 'sinon';
import { ProfileFileChannel } from '../common/schema.js';
import {
    S3Client,
    HeadObjectCommand,
    ListObjectsV2Command,
    DeleteObjectsCommand,
} from '@aws-sdk/client-s3';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user({ username: 'admin' });
flight.user({ username: 'member', admin: false });

const assetId = '1e34f3bc-3c34-4f0a-8b52-91bd8b0d25d3';
const iconsetId = 'profile-iconset';

test('PROFILE: asset iconset integration', async () => {
    let stub: Sinon.SinonStub | undefined;

    try {
        stub = Sinon.stub(S3Client.prototype, 'send').callsFake((command) => {
            if (command instanceof HeadObjectCommand) {
                assert.deepEqual(command.input, {
                    Bucket: 'fake-asset-bucket',
                    Key: `profile/admin@example.com/${assetId}.zip`,
                });

                return Promise.resolve({
                    ContentLength: 123,
                });
            }

            throw new Error(`Unknown S3 Command: ${command.constructor.name}`);
        });

        const asset = await flight.fetch('/api/profile/asset', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                id: assetId,
                name: 'icon-asset.zip',
                path: '/',
                artifacts: [],
            },
        }, true);

        assert.ok(asset.body.created, 'asset has created');
        assert.ok(asset.body.updated, 'asset has updated');
    } catch (err) {
        assert.ifError(err);
    } finally {
        stub?.restore();
        Sinon.restore();
    }
});

test('PROFILE: iconset creation, icon upload, regen', async () => {
    try {
        const iconset = await flight.fetch('/api/iconset', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                uid: iconsetId,
                version: 1,
                name: 'Profile Iconset',
                internal: true,
                scope: 'user',
            },
        }, true);

        assert.equal(iconset.body.uid, iconsetId);

        const icon = await flight.fetch(`/api/iconset/${iconsetId}/icon?regen=false`, {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                name: 'camera.png',
                data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            },
        }, true);

        assert.equal(icon.body.iconset, iconsetId);

        const spriteJson = await flight.fetch(`/api/iconset/${iconsetId}/sprite.json`, {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, false);

        assert.equal(spriteJson.status, 400);
        assert.equal(spriteJson.body.message, 'Request regeneration of Iconset Spritesheet');

        const spritePng = await flight.fetch(`/api/iconset/${iconsetId}/sprite.png`, {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, false);

        assert.equal(spritePng.status, 400);
        assert.equal(spritePng.body.message, 'Request regeneration of Iconset Spritesheet');

        await flight.fetch(`/api/iconset/${iconsetId}/regen`, {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);
    } catch (err) {
        assert.ifError(err);
    }
});

test('PROFILE: assign iconset to asset', async () => {
    let stub: Sinon.SinonStub | undefined;

    try {
        stub = Sinon.stub(S3Client.prototype, 'send').callsFake((command) => {
            if (command instanceof ListObjectsV2Command) {
                return Promise.resolve({
                    Contents: [],
                });
            } else if (command instanceof DeleteObjectsCommand) {
                return Promise.resolve({});
            }

            throw new Error(`Unknown S3 Command: ${command.constructor.name}`);
        });

        const patched = await flight.fetch(`/api/profile/asset/${assetId}`, {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                iconset: iconsetId,
            },
        }, true);

        assert.equal(patched.body.iconset, iconsetId);

        const list = await flight.fetch('/api/profile/asset', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        const found = list.body.items.find((i: { id: string; iconset: string | null }) => i.id === assetId);
        assert.ok(found, 'asset returned from list');
        assert.equal(found.iconset, iconsetId);

        await flight.fetch(`/api/profile/asset/${assetId}`, {
            method: 'DELETE',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);
    } catch (err) {
        assert.ifError(err);
    } finally {
        stub?.restore();
        Sinon.restore();
    }
});

test('PROFILE: verify cascade delete of icons', async () => {
    try {
        const iconsets = await flight.fetch(`/api/iconset/${iconsetId}`, {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, false);

        assert.deepEqual(iconsets.body, {
            message: 'Item Not Found',
            messages: [],
            status: 404,
        });

        const icons = await flight.fetch(`/api/icon?iconset=${iconsetId}`, {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, false);

        assert.deepEqual(icons.body, {
            message: 'Item Not Found',
            messages: [],
            status: 404,
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('PROFILE: iconset of a channel shared asset is readable by channel members', async () => {
    const sharedIconset = 'shared-iconset';
    const sharedAsset = '5b0c6c1e-6c0a-4f0e-9a52-3d1d6f1f6a11';

    const read = async (url: string) => {
        return await flight.fetch(url, {
            method: 'GET',
            auth: {
                bearer: flight.token.member,
            },
        }, false);
    };

    try {
        flight.tak.mockMarti.unshift(async (request, response) => {
            if (request.method === 'GET' && request.url === '/Marti/api/groups/all?useCache=true') {
                response.setHeader('Content-Type', 'application/json');
                response.write(JSON.stringify({
                    version: '3',
                    type: 'com.bbn.marti.remote.groups.Group',
                    data: [{
                        name: 'Shared Ops',
                        direction: 'IN',
                        active: true,
                        bitpos: 42,
                    }],
                }));
                response.end();
                return true;
            }

            return false;
        });

        await flight.fetch('/api/iconset', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                uid: sharedIconset,
                version: 1,
                name: 'Shared Iconset',
                internal: true,
                scope: 'user',
            },
        }, true);

        await flight.fetch(`/api/iconset/${sharedIconset}/icon?regen=false`, {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                name: 'camera.png',
                data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            },
        }, true);

        await flight.config?.models.ProfileFile.generate({
            id: sharedAsset,
            username: 'admin@example.com',
            path: '/',
            name: 'shared.kmz',
            iconset: sharedIconset,
            size: 456,
            artifacts: [],
        });

        const unshared = await read(`/api/iconset/${sharedIconset}/icon/camera`);
        assert.equal(unshared.status, 400);
        assert.equal(unshared.body.message, 'You don\'t have permission to access this resource');

        await flight.config?.pg.insert(ProfileFileChannel).values({
            file: sharedAsset,
            channel: 7n,
        });

        assert.equal((await read(`/api/iconset/${sharedIconset}/icon/camera`)).status, 400);

        await flight.config?.pg.insert(ProfileFileChannel).values({
            file: sharedAsset,
            channel: 42n,
        });

        const icon = await read(`/api/iconset/${sharedIconset}/icon/camera`);
        assert.equal(icon.status, 200);
        assert.equal(icon.body.iconset, sharedIconset);

        const iconset = await read(`/api/iconset/${sharedIconset}`);
        assert.equal(iconset.status, 200);
        assert.equal(iconset.body.uid, sharedIconset);

        const icons = await read(`/api/icon?iconset=${sharedIconset}`);
        assert.equal(icons.status, 200);
        assert.equal(icons.body.total, 1);

        const all = await read('/api/icon');
        assert.equal(all.status, 200);
        assert.ok(!all.body.items.some((i: { iconset: string }) => i.iconset === sharedIconset));

        const patch = await flight.fetch(`/api/iconset/${sharedIconset}`, {
            method: 'PATCH',
            auth: {
                bearer: flight.token.member,
            },
            body: {
                default_group: 'Hijacked',
            },
        }, false);
        assert.equal(patch.status, 400);
    } catch (err) {
        assert.ifError(err);
    }
});

flight.landing();
