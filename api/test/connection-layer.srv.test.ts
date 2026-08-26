import test from 'node:test';
import assert from 'node:assert';
import { sql, eq } from 'drizzle-orm';
import { ConnectionFeature, VideoLease } from '../common/schema.js';
import jwt from 'jsonwebtoken';
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
    ListStacksCommand,
    CloudFormationClient,
} from '@aws-sdk/client-cloudformation';
import {
    CloudWatchLogsClient,
    DeleteLogGroupCommand,
} from '@aws-sdk/client-cloudwatch-logs';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();
flight.user({ username: 'user', admin: false });

flight.connection();

process.env.ECR_TASKS_REPOSITORY_NAME = 'example-ecr';

test('GET: api/connection/1/layer', async () => {
    try {
        const res = await flight.fetch('/api/connection/1/layer', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.deepEqual(res.body, {
            status: {
                healthy: 0,
                alarm: 0,
                unknown: 0,
            },
            tasks: [],
            total: 0,
            items: [],
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
                    StackName: 'test',
                });
                return Promise.resolve({});
            } else {
                throw new Error('Unexpected command');
            }
        });

        Sinon.stub(CloudWatchLogsClient.prototype, 'send').callsFake((command) => {
            if (command instanceof DeleteLogGroupCommand) {
                assert.deepEqual(command.input, {
                    logGroupName: '/aws/lambda/test-layer-1',
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
                    imageIds: [{ imageTag: 'etl-test-v1.0.0' }],
                });

                return Promise.resolve({
                    images: [{
                        imageId: {
                            imageTag: 'etl-test-v1.0.0',
                            imageDigest: 'sha256:abcdef1234567890',
                        },
                        imageManifest: '{}',
                    }],
                });
            } else {
                throw new Error('Unexpected command');
            }
        });

        const res = await flight.fetch('/api/connection/1/layer', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                name: 'Test Layer',
                description: 'This is a test layer',
                task: 'etl-test-v1.0.0',
            },
        }, true);

        assert.ok(res.body.uuid, 'has uuid');
        res.body.uuid = '123';

        assert.ok(res.body.created, 'has created');
        res.body.created = '2025-06-26';

        assert.ok(res.body.created, 'has updated');
        res.body.updated = '2025-06-26';

        assert.deepEqual(res.body, {
            status: 'unknown',
            id: 1,
            uuid: '123',
            priority: 'off',
            permissions: [],
            template: false,
            created: '2025-06-26',
            updated: '2025-06-26',
            username: 'admin@example.com',
            name: 'Test Layer',
            description: 'This is a test layer',
            enabled: true,
            protected: false,
            logging: true,
            task: 'etl-test-v1.0.0',
            connection: 1,
            memory: 256,
            timeout: 120,
            alarm_period: 30,
            alarm_evals: 5,
            alarm_points: 4,
            parent: {
                id: 1,
                name: 'Test Connection',
                enabled: true,
            },
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
                bearer: flight.token.admin,
            },
        }, true);

        assert.ok(res.body.uuid, 'has uuid');
        res.body.uuid = '123';

        assert.ok(res.body.created, 'has created');
        res.body.created = '2025-06-26';

        assert.ok(res.body.created, 'has updated');
        res.body.updated = '2025-06-26';

        assert.deepEqual(res.body, {
            status: 'unknown',
            id: 1,
            uuid: '123',
            priority: 'off',
            permissions: [],
            template: false,
            created: '2025-06-26',
            updated: '2025-06-26',
            username: 'admin@example.com',
            name: 'Test Layer',
            description: 'This is a test layer',
            enabled: true,
            protected: false,
            logging: true,
            task: 'etl-test-v1.0.0',
            connection: 1,
            memory: 256,
            timeout: 120,
            alarm_period: 30,
            alarm_evals: 5,
            alarm_points: 4,
            parent: {
                id: 1,
                name: 'Test Connection',
                enabled: true,
            },
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
                bearer: flight.token.admin,
            },
            body: {
                protected: true,
            },
        }, true);

        assert.ok(res.body.uuid, 'has uuid');
        res.body.uuid = '123';

        assert.ok(res.body.created, 'has created');
        res.body.created = '2025-06-26';

        assert.ok(res.body.updated, 'has updated');
        res.body.updated = '2025-06-26';

        assert.deepEqual(res.body, {
            status: 'unknown',
            id: 1,
            uuid: '123',
            priority: 'off',
            permissions: [],
            template: false,
            created: '2025-06-26',
            updated: '2025-06-26',
            username: 'admin@example.com',
            name: 'Test Layer',
            description: 'This is a test layer',
            enabled: true,
            protected: true,
            logging: true,
            task: 'etl-test-v1.0.0',
            connection: 1,
            memory: 256,
            timeout: 120,
            alarm_period: 30,
            alarm_evals: 5,
            alarm_points: 4,
            parent: {
                id: 1,
                name: 'Test Connection',
                enabled: true,
            },
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
                bearer: flight.token.admin,
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
                bearer: flight.token.admin,
            },
            body: {
                protected: false,
            },
        }, true);

        assert.ok(res.body.uuid, 'has uuid');
        res.body.uuid = '123';

        assert.ok(res.body.created, 'has created');
        res.body.created = '2025-06-26';

        assert.ok(res.body.updated, 'has updated');
        res.body.updated = '2025-06-26';

        assert.deepEqual(res.body, {
            status: 'unknown',
            id: 1,
            uuid: '123',
            priority: 'off',
            permissions: [],
            template: false,
            created: '2025-06-26',
            updated: '2025-06-26',
            username: 'admin@example.com',
            name: 'Test Layer',
            description: 'This is a test layer',
            enabled: true,
            protected: false,
            logging: true,
            task: 'etl-test-v1.0.0',
            connection: 1,
            memory: 256,
            timeout: 120,
            alarm_period: 30,
            alarm_evals: 5,
            alarm_points: 4,
            parent: {
                id: 1,
                name: 'Test Connection',
                enabled: true,
            },
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/connection/1/layer/1 - set permissions', async () => {
    try {
        const res = await flight.fetch('/api/connection/1/layer/1', {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                permissions: ['feature:submit', 'video:*'],
            },
        }, true);

        assert.deepEqual(res.body.permissions, ['feature:submit', 'video:*']);

        const unset = await flight.fetch('/api/connection/1/layer/1', {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                permissions: [],
            },
        }, true);

        assert.deepEqual(unset.body.permissions, []);
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/connection/1/layer/1 - invalid permissions', async () => {
    try {
        const res = await flight.fetch('/api/connection/1/layer/1', {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                permissions: ['feature:read'],
            },
        }, false);

        assert.equal(res.status, 400);
        assert.ok(String(res.body.message).startsWith('Unknown Permission: feature:read'));
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/connection/1/layer/1 - layer token cannot modify permissions', async () => {
    try {
        const token = 'etl.' + jwt.sign({ access: 'layer', id: 1, internal: true }, 'coe-wildland-fire');

        const res = await flight.fetch('/api/connection/1/layer/1', {
            method: 'PATCH',
            auth: { bearer: token },
            body: { permissions: ['video:*'] },
        }, false);

        assert.equal(res.status, 403);
        assert.equal(res.body.message, 'Layer tokens cannot modify Layer permissions');

        const allowed = await flight.fetch('/api/connection/1/layer/1', {
            method: 'PATCH',
            auth: { bearer: token },
            body: { description: 'Updated by Layer Token' },
        }, true);

        assert.equal(allowed.body.description, 'Updated by Layer Token');
        assert.deepEqual(allowed.body.permissions, []);
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/layer/update-management', async () => {
    let stacklessLayerId: number | undefined;

    try {
        const stacklessLayer = await flight.config!.models.Layer.generate({
            name: 'Undeployed Layer',
            description: 'This layer has not been deployed',
            task: 'etl-test-v1.1.0',
            connection: 1,
        });

        stacklessLayerId = stacklessLayer.id;

        Sinon.stub(ECRClient.prototype, 'send').callsFake((command) => {
            if (command instanceof ListImagesCommand) {
                assert.deepEqual(command.input, {
                    repositoryName: process.env.ECR_TASKS_REPOSITORY_NAME,
                });

                return Promise.resolve({
                    imageIds: [
                        { imageTag: 'etl-test-v1.1.0' },
                        { imageTag: 'etl-test-v1.0.0' },
                    ],
                });
            }

            throw new Error('Unexpected command');
        });

        Sinon.stub(CloudFormationClient.prototype, 'send').callsFake((command) => {
            if (command instanceof ListStacksCommand) {
                assert.equal(command.input.NextToken, undefined);

                return Promise.resolve({
                    StackSummaries: [{
                        StackName: 'test-layer-1',
                        StackStatus: 'UPDATE_COMPLETE',
                    }, {
                        StackName: 'test-layer-99',
                        StackStatus: 'DELETE_COMPLETE',
                    }, {
                        StackName: 'other-stack',
                        StackStatus: 'CREATE_COMPLETE',
                    }],
                });
            }

            throw new Error(`Unexpected CloudFormation command: ${command.constructor.name}`);
        });

        const res = await flight.fetch('/api/layer/update-management', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, false);

        assert.deepEqual(res.body, {
            total: 2,
            items: [{
                id: 1,
                name: 'Test Layer',
                task_prefix: 'etl-test',
                current_version: '1.0.0',
                latest_version: '1.1.0',
                has_update: true,
                has_stack: true,
                connection: 1,
                parent_name: 'Test Connection',
            }, {
                id: 2,
                name: 'Undeployed Layer',
                task_prefix: 'etl-test',
                current_version: '1.1.0',
                latest_version: '1.1.0',
                has_update: false,
                has_stack: false,
                connection: 1,
                parent_name: 'Test Connection',
            }],
        });
    } catch (err) {
        assert.ifError(err);
    } finally {
        if (stacklessLayerId !== undefined) {
            await flight.config!.models.Layer.delete(stacklessLayerId);
        }

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
                                CreationTime: new Date(),
                            }],
                        });
                    }

                    throw new Error('Stack with id test-layer-1 does not exist');
                } else if (command.input.StackName === 'test') {
                    return Promise.resolve({
                        Stacks: [{ Tags: [] }],
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
                    logGroupName: '/aws/lambda/test-layer-1',
                });

                return Promise.resolve({});
            }

            throw new Error('Unexpected command');
        });

        const res = await flight.fetch('/api/connection/1/layer/1', {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                task: 'etl-test-v1.1.0',
            },
        }, false);

        assert.equal(res.body.task, 'etl-test-v1.1.0');

        const updated = await flight.fetch('/api/connection/1/layer/1', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(updated.body.task, 'etl-test-v1.1.0');
    } catch (err) {
        assert.ifError(err);
    } finally {
        Sinon.restore();
    }
});

test('DELETE: api/connection/1/layer/:id - layer with written COT features', async () => {
    let layerId: number | undefined;
    let leaseId: number | undefined;

    try {
        const layer = await flight.config!.models.Layer.generate({
            name: 'Feature Layer',
            description: 'Layer that has written COT features to the map',
            task: 'etl-test-v1.0.0',
            connection: 1,
        });

        layerId = layer.id;

        // Simulate a COT feature written to the map by this layer
        await flight.config!.models.ConnectionFeature.generate({
            id: 'feature-1594',
            connection: 1,
            layer: layer.id,
            path: '/',
            properties: {
                type: 'a-f-g',
                callsign: 'Feature 1594',
                how: 'h-g-i-g-o',
                time: '2026-07-24T00:00:00.000Z',
                start: '2026-07-24T00:00:00.000Z',
                stale: '2026-07-24T00:05:00.000Z',
                center: [0, 0, 0],
            },
            geometry: {
                type: 'Point',
                coordinates: [0, 0, 0],
            },
        });

        // Simulate a video lease scoped to this layer
        const lease = await flight.config!.models.VideoLease.generate({
            name: 'Layer Lease',
            path: '/layer/1594',
            connection: 1,
            layer: layer.id,
        });

        leaseId = lease.id;

        Sinon.stub(CloudFormationClient.prototype, 'send').callsFake((command) => {
            if (command instanceof DescribeStacksCommand) {
                return Promise.resolve({
                    Stacks: [{
                        StackName: 'test',
                        StackStatus: 'UPDATE_COMPLETE',
                        CreationTime: new Date(),
                    }],
                });
            } else {
                return Promise.resolve({});
            }
        });

        const res = await flight.fetch(`/api/connection/1/layer/${layer.id}`, {
            method: 'DELETE',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.deepEqual(res.body, {
            status: 200,
            message: 'Layer Deleted',
        });

        // The features written by the layer should be deleted along with it
        const features = await flight.config!.pg
            .select()
            .from(ConnectionFeature)
            .where(sql`
                connection = ${1}
                AND id = ${'feature-1594'}
            `);

        assert.equal(features.length, 0);

        // The video lease should be preserved but detached from the deleted layer
        const leases = await flight.config!.pg
            .select()
            .from(VideoLease)
            .where(eq(VideoLease.id, leaseId!));

        assert.equal(leases.length, 1);
        assert.equal(leases[0].layer, null);
    } catch (err) {
        assert.ifError(err);
    } finally {
        await flight.config!.models.ConnectionFeature.delete(sql`
            id = ${'feature-1594'}
            AND connection = ${1}
        `);

        if (leaseId !== undefined) {
            await flight.config!.models.VideoLease.delete(leaseId);
        }

        if (layerId !== undefined) {
            await flight.config!.models.Layer.delete(layerId);
        }

        Sinon.restore();
    }
});

test('POST: api/connection/1/layer - invalid incoming cron', async () => {
    try {
        const res = await flight.fetch('/api/connection/1/layer', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                name: 'Invalid Cron Layer',
                description: 'This layer has an invalid cron',
                task: 'etl-test-v1.0.0',
                incoming: {
                    cron: '0/15 * * * ? *',
                },
            },
        }, false);

        assert.equal(res.status, 400);
        assert.equal(res.body.message, 'Unknown Schedule Type');
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/connection/1/layer - with incoming & outgoing config', async () => {
    let layerId: number | undefined;

    try {
        Sinon.stub(CloudFormationClient.prototype, 'send').callsFake((command) => {
            if (command instanceof DescribeStacksCommand) {
                assert.deepEqual(command.input, {
                    StackName: 'test',
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
                    imageIds: [{ imageTag: 'etl-test-v1.0.0' }],
                });

                return Promise.resolve({
                    images: [{
                        imageId: {
                            imageTag: 'etl-test-v1.0.0',
                            imageDigest: 'sha256:abcdef1234567890',
                        },
                        imageManifest: '{}',
                    }],
                });
            } else {
                throw new Error('Unexpected command');
            }
        });

        const res = await flight.fetch('/api/connection/1/layer', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                name: 'Capabilities Layer',
                description: 'This layer is created from a Capabilities document',
                task: 'etl-test-v1.0.0',
                memory: 512,
                timeout: 300,
                permissions: ['video:read'],
                incoming: {
                    cron: 'rate(1 minute)',
                    webhooks: true,
                },
                outgoing: {},
            },
        }, true);

        layerId = res.body.id;

        assert.equal(res.body.name, 'Capabilities Layer');
        assert.equal(res.body.memory, 512);
        assert.equal(res.body.timeout, 300);
        assert.deepEqual(res.body.permissions, ['video:read']);

        assert.ok(res.body.incoming, 'has incoming config');
        assert.equal(res.body.incoming.cron, 'rate(1 minute)');
        assert.equal(res.body.incoming.webhooks, true);

        assert.ok(res.body.outgoing, 'has outgoing config');
    } catch (err) {
        assert.ifError(err);
    } finally {
        if (layerId !== undefined) {
            await flight.config!.models.LayerIncoming.delete(layerId);
            await flight.config!.models.LayerOutgoing.delete(layerId);
            await flight.config!.models.Layer.delete(layerId);
        }

        Sinon.restore();
    }
});

test('POST: api/connection/0/layer - admin layer', async () => {
    let layerId: number | undefined;

    try {
        Sinon.stub(CloudFormationClient.prototype, 'send').callsFake((command) => {
            if (command instanceof DescribeStacksCommand) {
                assert.deepEqual(command.input, {
                    StackName: 'test',
                });
                return Promise.resolve({});
            } else {
                throw new Error('Unexpected command');
            }
        });

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
            } else {
                throw new Error('Unexpected command');
            }
        });

        const res = await flight.fetch('/api/connection/0/layer', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                name: 'Admin Layer',
                description: 'This is a server-wide admin layer',
                task: 'etl-test-v1.0.0',
            },
        }, true);

        layerId = res.body.id;

        assert.equal(res.body.name, 'Admin Layer');
        assert.equal(res.body.connection, null);
        assert.equal(res.body.username, 'admin@example.com');
        assert.equal(res.body.parent, undefined);
    } catch (err) {
        assert.ifError(err);
    } finally {
        if (layerId !== undefined) {
            await flight.config!.models.Layer.delete(layerId);
        }

        Sinon.restore();
    }
});

test('POST: api/connection/0/layer - admin layer requires admin', async () => {
    try {
        const res = await flight.fetch('/api/connection/0/layer', {
            method: 'POST',
            auth: {
                bearer: flight.token.user,
            },
            body: {
                name: 'Admin Layer',
                description: 'This is a server-wide admin layer',
                task: 'etl-test-v1.0.0',
            },
        }, false);

        assert.equal(res.status, 401);
    } catch (err) {
        assert.ifError(err);
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
                        CreationTime: new Date(),
                    }],
                });
            } else {
                return Promise.resolve({});
            }
        });

        const res = await flight.fetch('/api/connection/1/layer/1', {
            method: 'DELETE',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.deepEqual(res.body, {
            status: 200,
            message: 'Layer Deleted',
        });
    } catch (err) {
        assert.ifError(err);
    }

    Sinon.restore();
});

flight.landing();
