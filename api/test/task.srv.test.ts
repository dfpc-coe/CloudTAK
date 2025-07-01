import test from 'tape';
import Flight from './flight.js';
import Sinon from 'sinon';
import {
    ECRClient
} from '@aws-sdk/client-ecr';

const ECR_TASKS_REPOSITORY = process.env.ECR_TASKS_REPOSITORY_NAME || 'coe-ecr-etl-tasks';

const flight = new Flight();

flight.init();
flight.takeoff();
flight.user();

test('GET: api/task - empty', async (t) => {
    try {
        Sinon.stub(ECRClient.prototype, 'send').callsFake((command) => {
            t.deepEquals(command.input, {
                repositoryName: ECR_TASKS_REPOSITORY
            });
            return Promise.resolve({ imageIds: [] });
        });

        const res = await flight.fetch('/api/task', {
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

test('GET: api/task - empty', async (t) => {
    try {
        Sinon.stub(ECRClient.prototype, 'send').callsFake((command) => {
            t.deepEquals(command.input, {
                repositoryName: ECR_TASKS_REPOSITORY
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

        t.deepEquals(res.body, {
            total: 5,
            items: {
                test: [ '1.1.1', '1.1.0', '1.0.0' ],
                another: [ '10.1.0', '1.1.0' ]
            }
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    Sinon.restore();
    t.end();
});

flight.landing();
