import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';
import Sinon from 'sinon';
import {
    ECRClient
} from '@aws-sdk/client-ecr';

process.env.ECR_TASKS_REPOSITORY_NAME = 'example-ecr';

const flight = new Flight();

flight.init();
flight.takeoff();
flight.user();

test('GET: api/task - empty', async () => {
    try {
        Sinon.stub(ECRClient.prototype, 'send').callsFake((command) => {
            assert.deepEqual(command.input, {
                repositoryName: process.env.ECR_TASKS_REPOSITORY_NAME
            });
            return Promise.resolve({ imageIds: [] });
        });

        const res = await flight.fetch('/api/task', {
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

test('GET: api/task - empty', async () => {
    try {
        Sinon.stub(ECRClient.prototype, 'send').callsFake((command) => {
            assert.deepEqual(command.input, {
                repositoryName: process.env.ECR_TASKS_REPOSITORY_NAME
            });

            return Promise.resolve({
                imageIds: [{
                    imageTag: 'test-v1.1.1'
                },{
                    imageTag: 'test-v1.0.0'
                },{
                    imageTag: 'test-v1.1.0'
                },{
                    imageTag: 'another-v1.1.0'
                },{
                    imageTag: 'another-v10.1.0'
                }]
            });
        });

        const res = await flight.fetch('/api/task/raw', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        assert.deepEqual(res.body, {
            total: 5,
            items: {
                test: [ '1.1.1', '1.1.0', '1.0.0' ],
                another: [ '10.1.0', '1.1.0' ]
            }
        });
    } catch (err) {
        assert.ifError(err);
    }

    Sinon.restore();
});

flight.landing();
