import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';
import Sinon from 'sinon';
import {
    S3Client,
    HeadObjectCommand,
    ListObjectsV2Command,
    DeleteObjectsCommand
} from '@aws-sdk/client-s3';

const ADMIN_USERNAME = 'admin';
const ADMIN_EMAIL = `${ADMIN_USERNAME}@example.com`;
const flight = new Flight();

flight.init();
flight.takeoff();
flight.user({ username: ADMIN_USERNAME });

test('PROFILE: asset iconset integration', async () => {
    let stub: Sinon.SinonStub | undefined;
    try {
        const assetId = '1e34f3bc-3c34-4f0a-8b52-91bd8b0d25d3';
        const iconsetId = 'profile-iconset';

        stub = Sinon.stub(S3Client.prototype, 'send').callsFake((command) => {
            if (command instanceof HeadObjectCommand) {
                assert.deepEqual(command.input, {
                    Bucket: 'fake-asset-bucket',
                    Key: `profile/${ADMIN_EMAIL}/${assetId}.zip`
                });

                return Promise.resolve({
                    ContentLength: 123
                });
            } else if (command instanceof ListObjectsV2Command) {
                return Promise.resolve({
                    Contents: []
                });
            } else if (command instanceof DeleteObjectsCommand) {
                return Promise.resolve({});
            }

            throw new Error(`Unknown S3 Command: ${command.constructor.name}`);
        });

        const asset = await flight.fetch('/api/profile/asset', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                id: assetId,
                name: 'icon-asset.zip',
                path: '/',
                artifacts: []
            }
        }, true);

        assert.ok(asset.body.created, 'asset has created');
        assert.ok(asset.body.updated, 'asset has updated');

        const iconset = await flight.fetch('/api/iconset', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                uid: iconsetId,
                version: 1,
                name: 'Profile Iconset',
                internal: true,
                scope: 'user'
            }
        }, true);

        assert.equal(iconset.body.uid, iconsetId);

        const icon = await flight.fetch(`/api/iconset/${iconsetId}/icon?regen=false`, {
            method: 'POST',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                name: 'camera.png',
                data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
            }
        }, true);

        assert.equal(icon.body.iconset, iconsetId);

        const spriteJson = await flight.fetch(`/api/iconset/${iconsetId}/sprite.json`, {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, false);

        assert.equal(spriteJson.status, 400);
        assert.equal(spriteJson.body.message, 'Request regeneration of Iconset Spritesheet');

        const spritePng = await flight.fetch(`/api/iconset/${iconsetId}/sprite.png`, {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, false);

        assert.equal(spritePng.status, 400);
        assert.equal(spritePng.body.message, 'Request regeneration of Iconset Spritesheet');

        await flight.fetch(`/api/iconset/${iconsetId}/regen`, {
            method: 'POST',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        const patched = await flight.fetch(`/api/profile/asset/${assetId}`, {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                iconset: iconsetId
            }
        }, true);

        assert.equal(patched.body.iconset, iconsetId);

        const list = await flight.fetch('/api/profile/asset', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        const found = list.body.items.find((i: { id: string; iconset: string | null }) => i.id === assetId);
        assert.ok(found, 'asset returned from list');
        assert.equal(found.iconset, iconsetId);

        await flight.fetch(`/api/profile/asset/${assetId}`, {
            method: 'DELETE',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        const iconsets = await flight.fetch('/api/iconset', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        assert.ok(!iconsets.body.items.find((i: { uid: string }) => i.uid === iconsetId));

        const icons = await flight.fetch(`/api/icon?iconset=${iconsetId}`, {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        assert.equal(icons.body.total, 0);
    } catch (err) {
        assert.ifError(err);
    } finally {
        stub?.restore();
        Sinon.restore();
    }
});

flight.landing();
