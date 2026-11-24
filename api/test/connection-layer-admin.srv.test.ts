import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';
import Sinon from 'sinon';
import Lambda from '../stateless/lib/aws/lambda.js';
import ECR from '../stateless/lib/aws/ecr.js';
import {
    ECRClient,
    BatchGetImageCommand,
} from '@aws-sdk/client-ecr';
import {
    CreateStackCommand,
    DescribeStacksCommand,
    UpdateStackCommand,
    CloudFormationClient,
} from '@aws-sdk/client-cloudformation';
import {
    CloudWatchLogsClient,
    DeleteLogGroupCommand,
} from '@aws-sdk/client-cloudwatch-logs';
import {
    GetFunctionCommand,
    LambdaClient,
} from '@aws-sdk/client-lambda';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();
flight.user({ username: 'user', admin: false });
flight.integration('etl-test');

flight.connection();

process.env.ECR_TASKS_REPOSITORY_NAME = 'example-ecr';

let adminLayerId: number;
let connectionLayerId: number;
let invoked: string[] = [];

function stub(): void {
    invoked = [];

    Sinon.stub(CloudFormationClient.prototype, 'send').callsFake((command) => {
        if (command instanceof DescribeStacksCommand) {
            if (command.input.StackName === 'test') {
                return Promise.resolve({ Stacks: [{ Tags: [] }] });
            } else {
                return Promise.resolve({ Stacks: [{ StackStatus: 'UPDATE_COMPLETE' }] });
            }
        } else if (command instanceof CreateStackCommand || command instanceof UpdateStackCommand) {
            return Promise.resolve({});
        }

        throw new Error(`Unexpected CloudFormation command: ${command.constructor.name}`);
    });

    Sinon.stub(CloudWatchLogsClient.prototype, 'send').callsFake((command) => {
        if (command instanceof DeleteLogGroupCommand) {
            return Promise.resolve({});
        }

        throw new Error('Unexpected CloudWatch Logs command');
    });

    Sinon.stub(LambdaClient.prototype, 'send').callsFake((command) => {
        if (command instanceof GetFunctionCommand) {
            return Promise.resolve({ Code: {} });
        }

        throw new Error('Unexpected Lambda command');
    });

    Sinon.stub(Lambda, 'invoke').callsFake(async (config, layerid, type) => {
        invoked.push(`${layerid}:${type}`);
        return undefined;
    });

    Sinon.stub(ECR, 'capabilities').resolves(null);

    Sinon.stub(ECRClient.prototype, 'send').callsFake((command) => {
        if (command instanceof BatchGetImageCommand) {
            return Promise.resolve({
                images: [{
                    imageId: {
                        imageTag: 'etl-test-v1.0.0',
                        imageDigest: 'sha256:abcdef1234567890',
                    },
                    imageManifest: '{}',
                }],
            });
        }

        throw new Error('Unexpected ECR command');
    });
}

test('POST: api/connection/0/layer - admin layer with incoming & outgoing', async () => {
    try {
        stub();

        const res = await flight.fetch('/api/connection/0/layer', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                name: 'Admin Layer',
                description: 'This is a server-wide admin layer',
                task: 'etl-test-v1.0.0',
                incoming: {},
                outgoing: {},
            },
        }, true);

        adminLayerId = res.body.id;

        assert.equal(res.body.connection, null);
        assert.ok(res.body.incoming);
        assert.ok(res.body.outgoing);

        const connLayer = await flight.fetch('/api/connection/1/layer', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                name: 'Connection Layer',
                description: 'This is a connection layer',
                task: 'etl-test-v1.0.0',
                incoming: {},
                outgoing: {},
            },
        }, true);

        connectionLayerId = connLayer.body.id;
    } catch (err) {
        assert.ifError(err);
    } finally {
        Sinon.restore();
    }
});

test('PATCH: api/connection/0/layer/:id/incoming - cron', async () => {
    try {
        stub();

        const res = await flight.fetch(`/api/connection/0/layer/${adminLayerId}/incoming`, {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                cron: 'rate(5 minutes)',
            },
        }, true);

        assert.equal(res.body.cron, 'rate(5 minutes)');
        assert.deepEqual(invoked, []);
    } catch (err) {
        assert.ifError(err);
    } finally {
        Sinon.restore();
    }
});

test('PATCH: api/connection/0/layer/:id/incoming - environment', async () => {
    try {
        stub();

        const res = await flight.fetch(`/api/connection/0/layer/${adminLayerId}/incoming`, {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                environment: { username: 'etl' },
            },
        }, true);

        assert.deepEqual(res.body.environment, { username: 'etl' });
        assert.deepEqual(invoked, [`${adminLayerId}:environment:incoming`]);
    } catch (err) {
        assert.ifError(err);
    } finally {
        Sinon.restore();
    }
});

test('PATCH: api/connection/0/layer/:id/outgoing - environment', async () => {
    try {
        stub();

        const res = await flight.fetch(`/api/connection/0/layer/${adminLayerId}/outgoing`, {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                environment: { username: 'etl' },
            },
        }, true);

        assert.deepEqual(res.body.environment, { username: 'etl' });
        assert.deepEqual(invoked, [`${adminLayerId}:environment:outgoing`]);
    } catch (err) {
        assert.ifError(err);
    } finally {
        Sinon.restore();
    }
});

for (const direction of ['incoming', 'outgoing']) {
    test(`PATCH: api/connection/0/layer/:id/${direction} - requires admin`, async () => {
        try {
            const res = await flight.fetch(`/api/connection/0/layer/${adminLayerId}/${direction}`, {
                method: 'PATCH',
                auth: {
                    bearer: flight.token.user,
                },
                body: {
                    environment: { username: 'intruder' },
                },
            }, false);

            assert.equal(res.status, 401);
        } catch (err) {
            assert.ifError(err);
        }
    });

    test(`PATCH: api/connection/0/layer/:id/${direction} - rejects connection layer`, async () => {
        try {
            const res = await flight.fetch(`/api/connection/0/layer/${connectionLayerId}/${direction}`, {
                method: 'PATCH',
                auth: {
                    bearer: flight.token.admin,
                },
                body: {
                    environment: { username: 'etl' },
                },
            }, false);

            assert.equal(res.status, 400);
            assert.equal(res.body.message, 'Layer is not an admin layer');
        } catch (err) {
            assert.ifError(err);
        }
    });

    test(`PATCH: api/connection/1/layer/:id/${direction} - rejects admin layer`, async () => {
        try {
            const res = await flight.fetch(`/api/connection/1/layer/${adminLayerId}/${direction}`, {
                method: 'PATCH',
                auth: {
                    bearer: flight.token.admin,
                },
                body: {
                    environment: { username: 'etl' },
                },
            }, false);

            assert.notEqual(res.status, 200);
        } catch (err) {
            assert.ifError(err);
        }
    });
}

flight.landing();
