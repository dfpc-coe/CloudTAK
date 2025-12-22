import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';
import Sinon from 'sinon';
import {
    S3Client
} from '@aws-sdk/client-s3';

const flight = new Flight();

flight.init();
flight.takeoff();
flight.user();

flight.connection();

const time = new Date('2025-03-04T22:54:15.447Z').getTime()

test('GET: api/connection/1/asset', async () => {
    try {
        Sinon.stub(S3Client.prototype, 'send').callsFake((command) => {
            assert.deepEqual(command.input, {
                Bucket: 'fake-asset-bucket',
                Prefix: 'connection/1/'
            });
            return Promise.resolve({
                Contents: []
            });
        });

        const res = await flight.fetch('/api/connection/1/asset', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        assert.deepEqual(res.body, {
            total: 0,
            items: []
        });
    } catch (err) {
        assert.ifError(err);
    }

    Sinon.restore();
});

test('GET: api/connection/1/asset - result', async () => {
    try {
        Sinon.stub(S3Client.prototype, 'send').callsFake((command) => {
            assert.deepEqual(command.input, {
                Bucket: 'fake-asset-bucket',
                Prefix: 'connection/1/'
            });
            return Promise.resolve({
                Contents: [{
                    Key: 'connection/1/image.png',
                    Size: 123456,
                    LastModified: new Date(time),
                    ETag: '"123"'
                }]
            });
        });

        const res = await flight.fetch('/api/connection/1/asset', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        assert.ok(res.body.items[0].updated);
        res.body.items[0].updated = time

        assert.deepEqual(res.body, {
            total: 1,
            items: [{
                name: 'image.png',
                size: 123456,
                updated: time,
                etag: '123'
            }]
        });
    } catch (err) {
        assert.ifError(err);
    }

    Sinon.restore();
});


flight.landing();
