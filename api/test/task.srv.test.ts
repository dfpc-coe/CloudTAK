import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';
import Sinon from 'sinon';
import {
    ECRClient,
    ListImagesCommand,
    BatchGetImageCommand,
} from '@aws-sdk/client-ecr';

process.env.ECR_TASKS_REPOSITORY_NAME = 'example-ecr';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();

test('GET: api/task - empty', async () => {
    try {
        Sinon.stub(ECRClient.prototype, 'send').callsFake((command) => {
            assert.deepEqual(command.input, {
                repositoryName: process.env.ECR_TASKS_REPOSITORY_NAME,
            });
            return Promise.resolve({ imageIds: [] });
        });

        const res = await flight.fetch('/api/task', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.deepEqual(res.body, {
            total: 0,
            items: [],
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
                repositoryName: process.env.ECR_TASKS_REPOSITORY_NAME,
            });

            return Promise.resolve({
                imageIds: [{
                    imageTag: 'test-v1.1.1',
                }, {
                    imageTag: 'test-v1.0.0',
                }, {
                    imageTag: 'test-v1.1.0',
                }, {
                    imageTag: 'another-v1.1.0',
                }, {
                    imageTag: 'another-v10.1.0',
                }],
            });
        });

        const res = await flight.fetch('/api/task/raw', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.deepEqual(res.body, {
            total: 5,
            items: {
                test: ['1.1.1', '1.1.0', '1.0.0'],
                another: ['10.1.0', '1.1.0'],
            },
        });
    } catch (err) {
        assert.ifError(err);
    }

    Sinon.restore();
});

test('GET: api/task/raw/test/version/1.1.1 - capabilities annotation', async () => {
    try {
        const capabilities = {
            version: '1.0',
            name: 'Test Task',
            description: 'A Task used in testing',
            permissions: [{
                resource: 'feature:*',
                required: true,
                description: 'Test Task posts features to the map',
            }],
            compute: {
                memory: 256,
                timeout: 30,
            },
            invocations: {
                incoming: {
                    schedule: {
                        description: 'Poll for new features every minute',
                        default: {
                            enabled: true,
                            schedule: 'rate(1 minute)',
                        },
                    },
                    webhook: {
                        description: 'Receive features via webhook',
                        default: {
                            enabled: true,
                        },
                    },
                },
                outgoing: {
                    types: [{
                        resource: 'feature:*',
                        description: 'Accept all live incident features',
                    }],
                },
            },
        };

        Sinon.stub(ECRClient.prototype, 'send').callsFake((command) => {
            if (command instanceof ListImagesCommand) {
                return Promise.resolve({
                    imageIds: [{
                        imageTag: 'test-v1.1.1',
                    }],
                });
            } else if (command instanceof BatchGetImageCommand) {
                assert.deepEqual(command.input.imageIds, [{ imageTag: 'test-v1.1.1' }]);

                return Promise.resolve({
                    images: [{
                        imageManifest: JSON.stringify({
                            schemaVersion: 2,
                            mediaType: 'application/vnd.oci.image.manifest.v1+json',
                            annotations: {
                                'com.cloudtak.capabilities': JSON.stringify(capabilities),
                            },
                        }),
                    }],
                });
            } else {
                return Promise.reject(new Error('Unexpected ECR Command'));
            }
        });

        const res = await flight.fetch('/api/task/raw/test/version/1.1.1', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.deepEqual(res.body, {
            version: '1.1.1',
            deployed: false,
            capabilities,
        });
    } catch (err) {
        assert.ifError(err);
    }

    Sinon.restore();
});

test('GET: api/task/raw/test/version/1.1.1 - invalid capabilities annotation', async () => {
    try {
        Sinon.stub(ECRClient.prototype, 'send').callsFake((command) => {
            if (command instanceof ListImagesCommand) {
                return Promise.resolve({
                    imageIds: [{
                        imageTag: 'test-v1.1.1',
                    }],
                });
            } else if (command instanceof BatchGetImageCommand) {
                return Promise.resolve({
                    images: [{
                        imageManifest: JSON.stringify({
                            schemaVersion: 2,
                            mediaType: 'application/vnd.oci.image.manifest.v1+json',
                            annotations: {
                                'com.cloudtak.capabilities': JSON.stringify({
                                    name: 'test',
                                }),
                            },
                        }),
                    }],
                });
            } else {
                return Promise.reject(new Error('Unexpected ECR Command'));
            }
        });

        const res = await flight.fetch('/api/task/raw/test/version/1.1.1', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.deepEqual(res.body, {
            version: '1.1.1',
            deployed: false,
            capabilities: null,
        });
    } catch (err) {
        assert.ifError(err);
    }

    Sinon.restore();
});

test('GET: api/task/raw/test/version/1.1.1 - no capabilities annotation', async () => {
    try {
        Sinon.stub(ECRClient.prototype, 'send').callsFake((command) => {
            if (command instanceof ListImagesCommand) {
                return Promise.resolve({
                    imageIds: [{
                        imageTag: 'test-v1.1.1',
                    }],
                });
            } else if (command instanceof BatchGetImageCommand) {
                return Promise.resolve({
                    images: [{
                        imageManifest: JSON.stringify({
                            schemaVersion: 2,
                            mediaType: 'application/vnd.oci.image.manifest.v1+json',
                        }),
                    }],
                });
            } else {
                return Promise.reject(new Error('Unexpected ECR Command'));
            }
        });

        const res = await flight.fetch('/api/task/raw/test/version/1.1.1', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.deepEqual(res.body, {
            version: '1.1.1',
            deployed: false,
            capabilities: null,
        });
    } catch (err) {
        assert.ifError(err);
    }

    Sinon.restore();
});

flight.landing();
