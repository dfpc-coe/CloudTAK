import test from 'tape';
import Flight from './flight.js';
import Sinon from 'sinon';
import {
    S3Client
} from '@aws-sdk/client-s3';

const flight = new Flight();

flight.init();
flight.takeoff();
flight.user();

const time = new Date('2025-03-04T22:54:15.447Z').toISOString()

test('GET: api/attachments - no result', async (t) => {
    try {
        Sinon.stub(S3Client.prototype, 'send').callsFake((command) => {
            t.deepEquals(command.input, {
                Bucket: 'fake-asset-bucket',
                Prefix: 'attachment/123/'
            });
            return Promise.resolve({
                Contents: []
            });
        });

        const res = await flight.fetch('/api/attachment?hash=123', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        t.deepEquals(res.body, {
            total: 0,
            items: []
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    Sinon.restore();
    t.end();
});

test('GET: api/attachments - result', async (t) => {
    try {
        Sinon.stub(S3Client.prototype, 'send').callsFake((command) => {
            t.deepEquals(command.input, {
                Bucket: 'fake-asset-bucket',
                Prefix: 'attachment/123/'
            });
            return Promise.resolve({
                Contents: [{
                    Key: 'attachment/123/image.png',
                    Size: 123456,
                    LastModified: new Date(time),
                    ETag: '"123"'
                }]
            });
        });

        const res = await flight.fetch('/api/attachment?hash=123', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        t.deepEquals(res.body, {
            total: 1,
            items: [{
                hash: '123',
                ext: '.png',
                name: 'image.png',
                size: 123456,
                created: '2025-03-04T22:54:15.447Z'
            }]
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    Sinon.restore();
    t.end();
});


flight.landing();
