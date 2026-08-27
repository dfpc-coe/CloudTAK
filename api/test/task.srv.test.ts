import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';
import Sinon from 'sinon';
import {
    ECRClient,
    ListImagesCommand,
    BatchGetImageCommand,
    BatchDeleteImageCommand,
} from '@aws-sdk/client-ecr';

process.env.ECR_TASKS_REPOSITORY_NAME = 'example-ecr';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();
flight.user({ admin: false, username: 'user' });

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

test('POST: api/task - non-admin', async () => {
    try {
        const res = await flight.fetch('/api/task', {
            method: 'POST',
            auth: {
                bearer: flight.token.user,
            },
            body: {
                name: 'Test Task',
                prefix: 'etl-test',
            },
        }, false);

        assert.equal(res.status, 401, 'http: 401');
        assert.equal(res.body.message, 'User must be a System Administrator to access this resource');
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/task', async () => {
    try {
        const res = await flight.fetch('/api/task', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                name: 'Test Task',
                prefix: 'etl-test',
            },
        }, true);

        assert.ok(res.body.created);
        delete res.body.created;
        assert.ok(res.body.updated);
        delete res.body.updated;

        assert.deepEqual(res.body, {
            id: 1,
            name: 'Test Task',
            prefix: 'etl-test',
            favorite: false,
            logo: '',
            repo: '',
            readme: '',
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/task - single registered task', async () => {
    try {
        const res = await flight.fetch('/api/task', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(res.body.total, 1);
        assert.equal(res.body.items.length, 1);
        assert.equal(res.body.items[0].id, 1);
        assert.equal(res.body.items[0].prefix, 'etl-test');
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/task - prefix filter', async () => {
    try {
        const match = await flight.fetch('/api/task?prefix=etl-test', {
            method: 'GET',
            auth: { bearer: flight.token.admin },
        }, true);

        assert.equal(match.body.total, 1);
        assert.equal(match.body.items[0].prefix, 'etl-test');

        const miss = await flight.fetch('/api/task?prefix=etl-missing', {
            method: 'GET',
            auth: { bearer: flight.token.admin },
        }, true);

        assert.equal(miss.body.total, 0);
        assert.deepEqual(miss.body.items, []);
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/task/1', async () => {
    try {
        const res = await flight.fetch('/api/task/1', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(res.body.id, 1);
        assert.equal(res.body.name, 'Test Task');
        assert.equal(res.body.prefix, 'etl-test');
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/task/1', async () => {
    try {
        const res = await flight.fetch('/api/task/1', {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                name: 'Renamed Task',
                favorite: true,
            },
        }, true);

        assert.equal(res.body.name, 'Renamed Task');
        assert.equal(res.body.favorite, true);
        assert.equal(res.body.prefix, 'etl-test');
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/task/1/readme - no readme configured', async () => {
    try {
        const res = await flight.fetch('/api/task/1/readme', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.deepEqual(res.body, { body: '' });
    } catch (err) {
        assert.ifError(err);
    }
});

test('DELETE: api/task/1', async () => {
    try {
        const res = await flight.fetch('/api/task/1', {
            method: 'DELETE',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.deepEqual(res.body, {
            status: 200,
            message: 'Registered Task Deleted',
        });

        const list = await flight.fetch('/api/task', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(list.body.total, 0);
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/task/raw/test - version list sorted, non-semver tags ignored', async () => {
    try {
        Sinon.stub(ECRClient.prototype, 'send').callsFake(() => {
            return Promise.resolve({
                imageIds: [{
                    imageTag: 'test-v1.0.0',
                }, {
                    imageTag: 'test-v10.0.0',
                }, {
                    imageTag: 'test-v2.3.1',
                }, {
                    imageTag: 'not-a-semver-tag',
                }],
            });
        });

        const res = await flight.fetch('/api/task/raw/test', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.deepEqual(res.body, {
            total: 3,
            versions: [{
                version: '10.0.0',
                deployed: false,
            }, {
                version: '2.3.1',
                deployed: false,
            }, {
                version: '1.0.0',
                deployed: false,
            }],
        });
    } catch (err) {
        assert.ifError(err);
    }

    Sinon.restore();
});

test('GET: api/task/raw/unknown - no versions', async () => {
    try {
        Sinon.stub(ECRClient.prototype, 'send').callsFake(() => {
            return Promise.resolve({
                imageIds: [{
                    imageTag: 'test-v1.0.0',
                }],
            });
        });

        const res = await flight.fetch('/api/task/raw/unknown', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.deepEqual(res.body, {
            total: 0,
            versions: [],
        });
    } catch (err) {
        assert.ifError(err);
    }

    Sinon.restore();
});

test('GET: api/task/raw/unknown/version/1.0.0 - unknown task', async () => {
    try {
        Sinon.stub(ECRClient.prototype, 'send').callsFake(() => {
            return Promise.resolve({
                imageIds: [{
                    imageTag: 'test-v1.0.0',
                }],
            });
        });

        const res = await flight.fetch('/api/task/raw/unknown/version/1.0.0', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, false);

        assert.equal(res.status, 404, 'http: 404');
        assert.equal(res.body.message, 'Task does not exist');
    } catch (err) {
        assert.ifError(err);
    }

    Sinon.restore();
});

test('GET: api/task/raw/test/version/9.9.9 - unknown version', async () => {
    try {
        Sinon.stub(ECRClient.prototype, 'send').callsFake(() => {
            return Promise.resolve({
                imageIds: [{
                    imageTag: 'test-v1.0.0',
                }],
            });
        });

        const res = await flight.fetch('/api/task/raw/test/version/9.9.9', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, false);

        assert.equal(res.status, 404, 'http: 404');
        assert.equal(res.body.message, 'Task Version does not exist');
    } catch (err) {
        assert.ifError(err);
    }

    Sinon.restore();
});

test('GET: api/task/raw/test/version/1.1.1 - capabilities via image index', async () => {
    try {
        const capabilities = {
            version: '1.0',
            name: 'Test Task',
            description: 'A Task used in testing',
            permissions: [],
            compute: {
                memory: 128,
                timeout: 60,
            },
            invocations: {},
        };

        Sinon.stub(ECRClient.prototype, 'send').callsFake((command) => {
            if (command instanceof ListImagesCommand) {
                return Promise.resolve({
                    imageIds: [{
                        imageTag: 'test-v1.1.1',
                    }],
                });
            } else if (command instanceof BatchGetImageCommand && command.input.imageIds && command.input.imageIds[0].imageTag) {
                return Promise.resolve({
                    images: [{
                        imageManifest: JSON.stringify({
                            schemaVersion: 2,
                            mediaType: 'application/vnd.oci.image.index.v1+json',
                            manifests: [{
                                digest: 'sha256:attestation',
                                platform: { architecture: 'unknown', os: 'unknown' },
                            }, {
                                digest: 'sha256:real-image',
                                platform: { architecture: 'amd64', os: 'linux' },
                            }],
                        }),
                    }],
                });
            } else if (command instanceof BatchGetImageCommand) {
                assert.deepEqual(command.input.imageIds, [{ imageDigest: 'sha256:real-image' }]);

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

test('GET: api/task/raw/test/version/1.1.1 - malformed capabilities annotation', async () => {
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
                                'com.cloudtak.capabilities': '{"not": "valid json',
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

test('GET: api/task/raw/test/version/1.1.1 - ECR manifest fetch failure is tolerated', async () => {
    try {
        Sinon.stub(ECRClient.prototype, 'send').callsFake((command) => {
            if (command instanceof ListImagesCommand) {
                return Promise.resolve({
                    imageIds: [{
                        imageTag: 'test-v1.1.1',
                    }],
                });
            } else {
                return Promise.reject(new Error('ECR is unavailable'));
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

test('DELETE: api/task/raw/test/version/1.0.0', async () => {
    try {
        let deleted = false;

        Sinon.stub(ECRClient.prototype, 'send').callsFake((command) => {
            if (command instanceof ListImagesCommand) {
                return Promise.resolve({
                    imageIds: [{
                        imageTag: 'test-v1.0.0',
                    }],
                });
            } else if (command instanceof BatchDeleteImageCommand) {
                assert.deepEqual(command.input, {
                    repositoryName: process.env.ECR_TASKS_REPOSITORY_NAME,
                    imageIds: [{ imageTag: 'test-v1.0.0' }],
                });

                deleted = true;
                return Promise.resolve({});
            } else {
                return Promise.reject(new Error('Unexpected ECR Command'));
            }
        });

        const res = await flight.fetch('/api/task/raw/test/version/1.0.0', {
            method: 'DELETE',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.deepEqual(res.body, {
            status: 200,
            message: 'Deleted Task Version',
        });

        assert.equal(deleted, true, 'BatchDeleteImage was called');
    } catch (err) {
        assert.ifError(err);
    }

    Sinon.restore();
});

test('DELETE: api/task/raw/test/version/9.9.9 - unknown version', async () => {
    try {
        Sinon.stub(ECRClient.prototype, 'send').callsFake(() => {
            return Promise.resolve({
                imageIds: [{
                    imageTag: 'test-v1.0.0',
                }],
            });
        });

        const res = await flight.fetch('/api/task/raw/test/version/9.9.9', {
            method: 'DELETE',
            auth: {
                bearer: flight.token.admin,
            },
        }, false);

        assert.equal(res.status, 400, 'http: 400');
        assert.equal(res.body.message, 'Task Version does not exist');
    } catch (err) {
        assert.ifError(err);
    }

    Sinon.restore();
});

flight.landing();
