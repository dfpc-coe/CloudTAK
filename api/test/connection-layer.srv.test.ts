import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';
import Sinon from 'sinon';
import {
    ECRClient,
    BatchGetImageCommand,
    ListImagesCommand,
} from '@aws-sdk/client-ecr';
import {
    CreateStackCommand,
    DescribeStacksCommand,
    CloudFormationClient
} from '@aws-sdk/client-cloudformation';
import {
    CloudWatchLogsClient,
    DeleteLogGroupCommand
} from '@aws-sdk/client-cloudwatch-logs';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();

flight.connection();

process.env.ECR_TASKS_REPOSITORY_NAME = 'example-ecr';

test('GET: api/connection/1/layer', async () => {
    try {
        const res = await flight.fetch('/api/connection/1/layer', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        assert.deepEqual(res.body, {
            status: {
                healthy: 0,
                alarm: 0,
                unknown: 0
            },
            tasks: [],
            total: 0,
            items: []
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/connection/1/layer', async () => {
    try {
        Sinon.stub(CloudFormationClient.prototype, 'send').callsFake((command) => {
            if (command instanceof DescribeStacksCommand) {
                assert.deepEqual(command.input, {
                    StackName: 'test'
                });
                return Promise.resolve({});
            } else {
                throw new Error('Unexpected command');
            }
        });

        Sinon.stub(CloudWatchLogsClient.prototype, 'send').callsFake((command) => {
            if (command instanceof DeleteLogGroupCommand) {
                assert.deepEqual(command.input, {
                    logGroupName: '/aws/lambda/test-layer-1'
                });

                return Promise.resolve({});
            } else {
                throw new Error('Unexpected command');
            }
        });

        Sinon.stub(ECRClient.prototype, 'send').callsFake((command) => {
            if (command instanceof BatchGetImageCommand) {
                assert.deepEqual(command.input, {
                    repositoryName: process.env.ECR_TASKS_REPOSITORY_NAME,
                    imageIds: [{ imageTag: 'etl-test-v1.0.0' }]
                });

                return Promise.resolve({
                    images: [{
                        imageId: {
                            imageTag: 'etl-test-v1.0.0',
                            imageDigest: 'sha256:abcdef1234567890'
                        },
                        imageManifest: '{}'
                    }]
                });
            } else {
                throw new Error('Unexpected command');
            }
        });

        const res = await flight.fetch('/api/connection/1/layer', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                name: 'Test Layer',
                description: 'This is a test layer',
                task: 'etl-test-v1.0.0'
            }
        }, true);

        assert.ok(res.body.uuid, 'has uuid');
        res.body.uuid = '123'

        assert.ok(res.body.created, 'has created');
        res.body.created = '2025-06-26'

        assert.ok(res.body.created, 'has updated');
        res.body.updated = '2025-06-26'

        assert.deepEqual(res.body, {
             status: 'unknown',
             id: 1,
             uuid: '123',
             priority: 'off',
             created: '2025-06-26',
             updated: '2025-06-26',
             username: 'admin@example.com',
             name: 'Test Layer',
             description: 'This is a test layer',
             enabled: true,
             protected: false,
             logging: true,
             task: 'etl-test-v1.0.0',
             template: false,
             connection: 1,
             memory: 256,
             timeout: 120,
             alarm_period: 30,
             alarm_evals: 5,
             alarm_points: 4,
             parent: {
                 id: 1,
                 name: 'Test Connection',
                 enabled: true
             }
        });
    } catch (err) {
        assert.ifError(err);
    }

    Sinon.restore();
});

test('GET: api/connection/1/layer/1', async () => {
    try {
        const res = await flight.fetch('/api/connection/1/layer/1', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            },
        }, true);

        assert.ok(res.body.uuid, 'has uuid');
        res.body.uuid = '123'

        assert.ok(res.body.created, 'has created');
        res.body.created = '2025-06-26'

        assert.ok(res.body.created, 'has updated');
        res.body.updated = '2025-06-26'

        assert.deepEqual(res.body, {
             status: 'unknown',
             id: 1,
             uuid: '123',
             priority: 'off',
             created: '2025-06-26',
             updated: '2025-06-26',
             username: 'admin@example.com',
             name: 'Test Layer',
             description: 'This is a test layer',
             enabled: true,
             protected: false,
             logging: true,
             task: 'etl-test-v1.0.0',
             template: false,
             connection: 1,
             memory: 256,
             timeout: 120,
             alarm_period: 30,
             alarm_evals: 5,
             alarm_points: 4,
             parent: {
                 id: 1,
                 name: 'Test Connection',
                 enabled: true
             }
        });
    } catch (err) {
        assert.ifError(err);
    }

    Sinon.restore();
});

test('PATCH: api/connection/1/layer/1 - set protected', async () => {
    try {
        const res = await flight.fetch('/api/connection/1/layer/1', {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                protected: true
            }
        }, true);

        assert.ok(res.body.uuid, 'has uuid');
        res.body.uuid = '123'

        assert.ok(res.body.created, 'has created');
        res.body.created = '2025-06-26'

        assert.ok(res.body.updated, 'has updated');
        res.body.updated = '2025-06-26'

        assert.deepEqual(res.body, {
            status: 'unknown',
            id: 1,
            uuid: '123',
            priority: 'off',
            created: '2025-06-26',
            updated: '2025-06-26',
            username: 'admin@example.com',
            name: 'Test Layer',
            description: 'This is a test layer',
            enabled: true,
            protected: true,
            logging: true,
            task: 'etl-test-v1.0.0',
            template: false,
            connection: 1,
            memory: 256,
            timeout: 120,
            alarm_period: 30,
            alarm_evals: 5,
            alarm_points: 4,
            parent: {
                id: 1,
                name: 'Test Connection',
                enabled: true
            }
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('DELETE: api/connection/1/layer/1 - protected layer should fail', async () => {
    try {
        const res = await flight.fetch('/api/connection/1/layer/1', {
            method: 'DELETE',
            auth: {
                bearer: flight.token.admin
            },
        }, false);

        assert.equal(res.status, 400);
        assert.equal(res.body.message, 'Layer is protected and cannot be deleted');
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/connection/1/layer/1 - unset protected', async () => {
    try {
        const res = await flight.fetch('/api/connection/1/layer/1', {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                protected: false
            }
        }, true);

        assert.ok(res.body.uuid, 'has uuid');
        res.body.uuid = '123'

        assert.ok(res.body.created, 'has created');
        res.body.created = '2025-06-26'

        assert.ok(res.body.updated, 'has updated');
        res.body.updated = '2025-06-26'

        assert.deepEqual(res.body, {
            status: 'unknown',
            id: 1,
            uuid: '123',
            priority: 'off',
            created: '2025-06-26',
            updated: '2025-06-26',
            username: 'admin@example.com',
            name: 'Test Layer',
            description: 'This is a test layer',
            enabled: true,
            protected: false,
            logging: true,
            task: 'etl-test-v1.0.0',
            template: false,
            connection: 1,
            memory: 256,
            timeout: 120,
            alarm_period: 30,
            alarm_evals: 5,
            alarm_points: 4,
            parent: {
                id: 1,
                name: 'Test Connection',
                enabled: true
            }
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/layer/update-management', async () => {
    try {
        Sinon.stub(ECRClient.prototype, 'send').callsFake((command) => {
            if (command instanceof ListImagesCommand) {
                assert.deepEqual(command.input, {
                    repositoryName: process.env.ECR_TASKS_REPOSITORY_NAME,
                });

                return Promise.resolve({
                    imageIds: [
                        { imageTag: 'etl-test-v1.1.0' },
                        { imageTag: 'etl-test-v1.0.0' },
                    ]
                });
            }

            throw new Error('Unexpected command');
        });

        const res = await flight.fetch('/api/layer/update-management', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            },
        }, false);

        assert.deepEqual(res.body, {
            total: 1,
            items: [{
                id: 1,
                name: 'Test Layer',
                task_prefix: 'etl-test',
                current_version: '1.0.0',
                latest_version: '1.1.0',
                has_update: true,
                template: false,
                connection: 1,
                parent_name: 'Test Connection'
            }]
        });
    } catch (err) {
        assert.ifError(err);
    } finally {
        Sinon.restore();
    }
});

test('PATCH: api/connection/1/layer/1 - update task version', async () => {
    let describeCount = 0;

    try {
        Sinon.stub(CloudFormationClient.prototype, 'send').callsFake((command) => {
            if (command instanceof DescribeStacksCommand) {
                if (command.input.StackName === 'test-layer-1') {
                    describeCount++;

                    if (describeCount === 1) {
                        return Promise.resolve({
                            Stacks: [{
                                StackName: 'test-layer-1',
                                StackStatus: 'UPDATE_COMPLETE',
                                CreationTime: new Date()
                            }]
                        });
                    }

                    throw new Error('Stack with id test-layer-1 does not exist');
                } else if (command.input.StackName === 'test') {
                    return Promise.resolve({
                        Stacks: [{ Tags: [] }]
                    });
                }
            } else if (command instanceof CreateStackCommand) {
                return Promise.resolve({});
            }

            throw new Error(`Unexpected CloudFormation command: ${command.constructor.name}`);
        });

        Sinon.stub(CloudWatchLogsClient.prototype, 'send').callsFake((command) => {
            if (command instanceof DeleteLogGroupCommand) {
                assert.deepEqual(command.input, {
                    logGroupName: '/aws/lambda/test-layer-1'
                });

                return Promise.resolve({});
            }

            throw new Error('Unexpected command');
        });

        const res = await flight.fetch('/api/connection/1/layer/1', {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                task: 'etl-test-v1.1.0'
            }
        }, false);

        assert.equal(res.body.task, 'etl-test-v1.1.0');

        const updated = await flight.fetch('/api/connection/1/layer/1', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            },
        }, true);

        assert.equal(updated.body.task, 'etl-test-v1.1.0');
    } catch (err) {
        assert.ifError(err);
    } finally {
        Sinon.restore();
    }
});

test('DELETE: api/connection/1/layer/1', async () => {
    try {
        Sinon.stub(CloudFormationClient.prototype, 'send').callsFake((command) => {
            if (command instanceof DescribeStacksCommand) {
                return Promise.resolve({
                    Stacks: [{
                        StackName: 'test',
                        StackStatus: 'UPDATE_COMPLETE',
                        CreationTime: new Date()
                    }]
                });
            } else {
                return Promise.resolve({});
            }
        });

        const res = await flight.fetch('/api/connection/1/layer/1', {
            method: 'DELETE',
            auth: {
                bearer: flight.token.admin
            },
        }, true);

        assert.deepEqual(res.body, {
            status: 200,
            message: 'Layer Deleted'
        });
    } catch (err) {
        assert.ifError(err);
    }

    Sinon.restore();
});

flight.landing();
