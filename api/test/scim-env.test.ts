import test from 'node:test';
import assert from 'node:assert';
import ScimControl from '../stateless/lib/control/scim.js';
import type Config from '../common/config.js';
import type { AnyRequest } from '../common/auth.js';

/**
 * TAK-NZ: SCIM can be driven from the environment (`SCIM_ENABLED` / `SCIM_TOKEN`) so the CDK stack
 * and the Authentik SCIM provider share one Secrets Manager token. These tests cover that switch
 * without a database; the database-backed path is covered by scim.srv.test.ts.
 */

function control(dbSettings: Record<string, unknown> = {}): { scim: ScimControl, reads: () => number } {
    let reads = 0;

    const config = {
        models: {
            Setting: {
                typedMany: async (defaults: Record<string, unknown>) => {
                    reads++;
                    return { ...defaults, ...dbSettings };
                },
            },
        },
    } as unknown as Config;

    return { scim: new ScimControl(config), reads: () => reads };
}

function request(authorization?: string): AnyRequest {
    return {
        header: (name: string) => name.toLowerCase() === 'authorization' ? authorization : undefined,
    } as unknown as AnyRequest;
}

async function withEnv(env: Record<string, string | undefined>, fn: () => Promise<void>): Promise<void> {
    const previous: Record<string, string | undefined> = {};

    for (const [key, value] of Object.entries(env)) {
        previous[key] = process.env[key];
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
    }

    try {
        await fn();
    } finally {
        for (const [key, value] of Object.entries(previous)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    }
}

test('SCIM env: not set, the database settings are used', async () => {
    await withEnv({ SCIM_ENABLED: undefined, SCIM_TOKEN: 'env-token' }, async () => {
        const { scim, reads } = control({ 'scim::enabled': true, 'scim::token': 'db-token' });

        await scim.auth(request('Bearer db-token'));
        assert.equal(reads(), 1);

        await assert.rejects(scim.auth(request('Bearer env-token')), { message: 'Invalid SCIM token' });
    });
});

test('SCIM env: not set and disabled in the database is refused', async () => {
    await withEnv({ SCIM_ENABLED: undefined, SCIM_TOKEN: undefined }, async () => {
        const { scim } = control();

        await assert.rejects(scim.auth(request('Bearer anything')), { message: 'SCIM provisioning is not enabled' });
    });
});

test('SCIM env: SCIM_ENABLED=true uses SCIM_TOKEN and never reads the database', async () => {
    await withEnv({ SCIM_ENABLED: 'true', SCIM_TOKEN: 'env-token' }, async () => {
        const { scim, reads } = control({ 'scim::enabled': false, 'scim::token': 'db-token' });

        await scim.auth(request('Bearer env-token'));
        await scim.auth(request('bearer env-token'));
        assert.equal(reads(), 0);

        await assert.rejects(scim.auth(request('Bearer db-token')), { message: 'Invalid SCIM token' });
    });
});

test('SCIM env: SCIM_ENABLED=true without SCIM_TOKEN is refused', async () => {
    await withEnv({ SCIM_ENABLED: 'true', SCIM_TOKEN: '' }, async () => {
        const { scim } = control({ 'scim::enabled': true, 'scim::token': 'db-token' });

        await assert.rejects(scim.auth(request('Bearer db-token')), { message: 'SCIM token has not been configured' });
    });
});

test('SCIM env: a missing or malformed Authorization header is refused', async () => {
    await withEnv({ SCIM_ENABLED: 'true', SCIM_TOKEN: 'env-token' }, async () => {
        const { scim } = control();

        await assert.rejects(scim.auth(request()), { message: 'Bearer authorization is required' });
        await assert.rejects(scim.auth(request('Basic env-token')), { message: 'Bearer authorization is required' });
    });
});

test('SCIM env: only the literal string "true" enables env mode', async () => {
    await withEnv({ SCIM_ENABLED: 'false', SCIM_TOKEN: 'env-token' }, async () => {
        const { scim, reads } = control({ 'scim::enabled': true, 'scim::token': 'db-token' });

        await scim.auth(request('Bearer db-token'));
        assert.equal(reads(), 1);
    });
});
