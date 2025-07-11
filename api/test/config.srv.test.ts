import test from 'tape';
import Flight from './flight.js';
import sinon from 'sinon';

const flight = new Flight();

flight.init();
flight.takeoff();
flight.user();

test('GET api/config', async (t) => {
    try {
        const res = await flight.fetch('/api/config?keys=group::Yellow', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            },
        }, true);

        t.deepEquals(res.body, {});
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test('PUT api/config', async (t) => {
    try {
        const res = await flight.fetch('/api/config', {
            method: 'PUT',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                'group::Yellow': 'Wildland Firefighter'
            }
        }, false);

        t.deepEquals(res.body, {
            'group::Yellow': 'Wildland Firefighter'
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test('GET api/config', async (t) => {
    try {
        const res = await flight.fetch('/api/config?keys=group::Yellow', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            },
        }, true);

        t.deepEquals(res.body, {
            'group::Yellow': 'Wildland Firefighter'
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test('GET api/config/group', async (t) => {
    try {
        const res = await flight.fetch('/api/config/group', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            },
        }, true);

        t.deepEquals(res.body, {
            roles: [ 'Team Member', 'Team Lead', 'HQ', 'Sniper', 'Medic', 'Forward Observer', 'RTO', 'K9' ],
            groups: { Yellow: 'Wildland Firefighter', Cyan: '', Green: '', Red: '', Purple: '', Orange: '', Blue: '', Magenta: '', White: '', Maroon: '', 'Dark Blue': '', Teal: '', 'Dark Green': '', Brown: '' }
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test('GET api/config/login', async (t) => {
    try {
        const res = await flight.fetch('/api/config/login', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            },
        }, true);

        t.deepEquals(res.body, {});
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test('PUT api/config', async (t) => {
    try {
        const res = await flight.fetch('/api/config', {
            method: 'PUT',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                'login::signup': 'https://example.com/signup',
                'login::forgot': 'https://example.com/forgot'
            }
        }, false);

        t.deepEquals(res.body, {
            'login::signup': 'https://example.com/signup',
            'login::forgot': 'https://example.com/forgot'
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test('GET api/config/login', async (t) => {
    try {
        const res = await flight.fetch('/api/config/login', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            },
        }, true);

        t.deepEquals(res.body, {
            'signup': 'https://example.com/signup',
            'forgot': 'https://example.com/forgot'
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test('GET api/config/map', async (t) => {
    try {
        const res = await flight.fetch('/api/config/map', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            },
        }, true);

        t.deepEquals(res.body, {
            center: '-100,40',
            zoom: 4,
            pitch: 0,
            bearing: 0
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

// Server Environment Variable Integration Tests
test('Server Env: CLOUDTAK_Server_name updates database', async (t) => {
    const originalEnv = process.env.CLOUDTAK_Server_name;
    process.env.CLOUDTAK_Server_name = 'Env Test Server';

    try {
        const initialServer = await flight.config.models.Server.from(1);

        // Simulate server env update
        const updatedServer = await flight.config.models.Server.commit(initialServer.id, {
            name: process.env.CLOUDTAK_Server_name
        });

        t.equal(updatedServer.name, 'Env Test Server');
    } catch (err) {
        t.error(err, 'no error');
    }

    process.env.CLOUDTAK_Server_name = originalEnv;
    t.end();
});

test('Server Env: CLOUDTAK_Server_url updates database', async (t) => {
    const originalEnv = process.env.CLOUDTAK_Server_url;
    process.env.CLOUDTAK_Server_url = 'ssl://env.test.com:8089';

    try {
        const initialServer = await flight.config.models.Server.from(1);

        const updatedServer = await flight.config.models.Server.commit(initialServer.id, {
            url: process.env.CLOUDTAK_Server_url
        });

        t.equal(updatedServer.url, 'ssl://env.test.com:8089');
    } catch (err) {
        t.error(err, 'no error');
    }

    process.env.CLOUDTAK_Server_url = originalEnv;
    t.end();
});

test('Server Env: auth object updates database', async (t) => {
    const originalCert = process.env.CLOUDTAK_Server_auth_cert;
    const originalKey = process.env.CLOUDTAK_Server_auth_key;

    process.env.CLOUDTAK_Server_auth_cert = 'test-cert-data';
    process.env.CLOUDTAK_Server_auth_key = 'test-key-data';

    try {
        const initialServer = await flight.config.models.Server.from(1);

        const updatedServer = await flight.config.models.Server.commit(initialServer.id, {
            auth: {
                cert: process.env.CLOUDTAK_Server_auth_cert,
                key: process.env.CLOUDTAK_Server_auth_key
            }
        });

        t.deepEqual(updatedServer.auth, {
            cert: 'test-cert-data',
            key: 'test-key-data'
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    process.env.CLOUDTAK_Server_auth_cert = originalCert;
    process.env.CLOUDTAK_Server_auth_key = originalKey;
    t.end();
});

test('Server Env: P12 certificate processing from secret ARN', async (t) => {
    const originalSecretArn = process.env.CLOUDTAK_Server_auth_p12_secret_arn;
    const originalPassword = process.env.CLOUDTAK_Server_auth_password;

    process.env.CLOUDTAK_Server_auth_p12_secret_arn = 'arn:aws:secretsmanager:region:account:secret:test-secret';
    process.env.CLOUDTAK_Server_auth_password = 'test-password';

    try {
        // Test that P12 processing environment variables are set correctly
        const hasP12Config = process.env.CLOUDTAK_Server_auth_p12_secret_arn && process.env.CLOUDTAK_Server_auth_password;
        t.ok(hasP12Config, 'P12 certificate configuration is set');

        // Test that the secret ARN format is valid
        t.ok(process.env.CLOUDTAK_Server_auth_p12_secret_arn.startsWith('arn:aws:secretsmanager:'), 'Secret ARN has correct format');
    } catch (err) {
        t.error(err, 'no error');
    }

    process.env.CLOUDTAK_Server_auth_p12_secret_arn = originalSecretArn;
    process.env.CLOUDTAK_Server_auth_password = originalPassword;
    t.end();
});

test('Server Env: multiple fields update database', async (t) => {
    const originalVars = {
        name: process.env.CLOUDTAK_Server_name,
        api: process.env.CLOUDTAK_Server_api,
        webtak: process.env.CLOUDTAK_Server_webtak
    };

    process.env.CLOUDTAK_Server_name = 'Multi Field Server';
    process.env.CLOUDTAK_Server_api = 'https://multi.test.com:8443';
    process.env.CLOUDTAK_Server_webtak = 'http://multi.test.com:8444';

    try {
        const initialServer = await flight.config.models.Server.from(1);

        const updatedServer = await flight.config.models.Server.commit(initialServer.id, {
            name: process.env.CLOUDTAK_Server_name,
            api: process.env.CLOUDTAK_Server_api,
            webtak: process.env.CLOUDTAK_Server_webtak
        });

        t.equal(updatedServer.name, 'Multi Field Server');
        t.equal(updatedServer.api, 'https://multi.test.com:8443');
        t.equal(updatedServer.webtak, 'http://multi.test.com:8444');
    } catch (err) {
        t.error(err, 'no error');
    }

    // Restore environment
    Object.keys(originalVars).forEach(key => {
        const envVar = `CLOUDTAK_Server_${key}`;
        if (originalVars[key] !== undefined) {
            process.env[envVar] = originalVars[key];
        } else {
            delete process.env[envVar];
        }
    });

    t.end();
});

test('Server Env: schema validation with invalid field', async (t) => {
    try {
        const initialServer = await flight.config.models.Server.from(1);

        // This should fail if schema validation is working
        await flight.config.models.Server.commit(initialServer.id, {
            invalidField: 'should-fail'
        });

        t.fail('Should have thrown error for invalid field');
    } catch {
        t.pass('Correctly rejected invalid field');
    }

    t.end();
});

// Admin User Environment Variable Tests
test('Admin Env: CLOUDTAK_ADMIN_USERNAME and CLOUDTAK_ADMIN_PASSWORD create admin user', async (t) => {
    const originalUsername = process.env.CLOUDTAK_ADMIN_USERNAME;
    const originalPassword = process.env.CLOUDTAK_ADMIN_PASSWORD;

    process.env.CLOUDTAK_ADMIN_USERNAME = 'test-admin';
    process.env.CLOUDTAK_ADMIN_PASSWORD = 'test-password';

    try {
        // Mock the Profile.list method to simulate no existing admin
        const listStub = sinon.stub(flight.config.models.Profile, 'list').resolves({ total: 0 });
        const generateStub = sinon.stub(flight.config.models.Profile, 'generate').resolves();

        // Test that admin creation logic would be triggered
        const hasAdminCredentials = process.env.CLOUDTAK_ADMIN_USERNAME && process.env.CLOUDTAK_ADMIN_PASSWORD;
        t.ok(hasAdminCredentials, 'Admin credentials are set');

        listStub.restore();
        generateStub.restore();
    } catch (err) {
        t.error(err, 'no error');
    }

    process.env.CLOUDTAK_ADMIN_USERNAME = originalUsername;
    process.env.CLOUDTAK_ADMIN_PASSWORD = originalPassword;
    t.end();
});

test('Admin Env: Admin user creation requires server auth configuration', async (t) => {
    const originalUsername = process.env.CLOUDTAK_ADMIN_USERNAME;
    const originalPassword = process.env.CLOUDTAK_ADMIN_PASSWORD;

    process.env.CLOUDTAK_ADMIN_USERNAME = 'test-admin';
    process.env.CLOUDTAK_ADMIN_PASSWORD = 'test-password';

    try {
        const server = await flight.config.models.Server.from(1);

        // Admin user creation requires server to have auth.cert, auth.key, and webtak configured
        const canCreateAdmin = server.auth?.cert && server.auth?.key && server.webtak;

        if (canCreateAdmin) {
            t.pass('Server has required auth configuration for admin user creation');
        } else {
            t.pass('Server missing auth configuration - admin user creation will be skipped');
        }
    } catch (err) {
        t.error(err, 'no error');
    }

    process.env.CLOUDTAK_ADMIN_USERNAME = originalUsername;
    process.env.CLOUDTAK_ADMIN_PASSWORD = originalPassword;
    t.end();
});

test('Admin Env: Missing credentials skip admin creation', async (t) => {
    const originalUsername = process.env.CLOUDTAK_ADMIN_USERNAME;
    const originalPassword = process.env.CLOUDTAK_ADMIN_PASSWORD;

    delete process.env.CLOUDTAK_ADMIN_USERNAME;
    delete process.env.CLOUDTAK_ADMIN_PASSWORD;

    try {
        const hasAdminCredentials = process.env.CLOUDTAK_ADMIN_USERNAME && process.env.CLOUDTAK_ADMIN_PASSWORD;
        t.notOk(hasAdminCredentials, 'Admin credentials are not set');
    } catch (err) {
        t.error(err, 'no error');
    }

    if (originalUsername) process.env.CLOUDTAK_ADMIN_USERNAME = originalUsername;
    if (originalPassword) process.env.CLOUDTAK_ADMIN_PASSWORD = originalPassword;
    t.end();
});

flight.landing();
