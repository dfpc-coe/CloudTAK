import cron from 'node-cron';
import jwt from 'jsonwebtoken';

export interface RetentionTaskConfig {
    'retention::enabled'?: boolean;
    'retention::connection-feature::enabled'?: boolean;
    'retention::chat::enabled'?: boolean;
    'retention::import::enabled'?: boolean;
}

export interface RetentionTaskResult {
    name: string;
    status: 'success' | 'error';
    deleted: number;
    duration: number;
    message?: string;
}

export interface RetentionTask {
    name: string;
    enabled?: (config: RetentionTaskConfig) => boolean;
    run: () => Promise<RetentionTaskResult>;
}

const tasks: RetentionTask[] = [{
    name: 'connection-feature',
    enabled: (config: RetentionTaskConfig): boolean => {
        return config['retention::connection-feature::enabled'] !== false;
    },
    run: async (): Promise<RetentionTaskResult> => {
        const apiUrl = process.env.API_URL;
        const signingSecret = process.env.SigningSecret;

        if (!apiUrl || !signingSecret) {
            throw new Error('API_URL or SigningSecret not set');
        }

        const res = await fetch(new URL('/api/retention', apiUrl), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${jwt.sign({ access: 'admin', email: 'system' }, signingSecret, { expiresIn: '5m' })}`,
            },
            body: JSON.stringify({
                action: 'connection-feature'
            })
        });

        if (!res.ok) {
            throw new Error(`Failed to execute connection-feature retention: HTTP ${res.status}`);
        }

        return await res.json() as RetentionTaskResult;
    }
}, {
    name: 'chat',
    enabled: (config: RetentionTaskConfig): boolean => {
        return config['retention::chat::enabled'] === true;
    },
    run: async (): Promise<RetentionTaskResult> => {
        const apiUrl = process.env.API_URL;
        const signingSecret = process.env.SigningSecret;

        if (!apiUrl || !signingSecret) {
            throw new Error('API_URL or SigningSecret not set');
        }

        const res = await fetch(new URL('/api/retention', apiUrl), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${jwt.sign({ access: 'admin', email: 'system' }, signingSecret, { expiresIn: '5m' })}`,
            },
            body: JSON.stringify({
                action: 'chat'
            })
        });

        if (!res.ok) {
            throw new Error(`Failed to execute chat retention: HTTP ${res.status}`);
        }

        return await res.json() as RetentionTaskResult;
    }
}, {
    name: 'import',
    enabled: (config: RetentionTaskConfig): boolean => {
        return config['retention::import::enabled'] === true;
    },
    run: async (): Promise<RetentionTaskResult> => {
        const apiUrl = process.env.API_URL;
        const signingSecret = process.env.SigningSecret;

        if (!apiUrl || !signingSecret) {
            throw new Error('API_URL or SigningSecret not set');
        }

        const res = await fetch(new URL('/api/retention', apiUrl), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${jwt.sign({ access: 'admin', email: 'system' }, signingSecret, { expiresIn: '5m' })}`,
            },
            body: JSON.stringify({
                action: 'import'
            })
        });

        if (!res.ok) {
            throw new Error(`Failed to execute import retention: HTTP ${res.status}`);
        }

        return await res.json() as RetentionTaskResult;
    }
}];

async function runOnce(): Promise<void> {
    const apiUrl = process.env.API_URL;
    const signingSecret = process.env.SigningSecret;

    if (!apiUrl || !signingSecret) {
        console.log('ok - API_URL or SigningSecret not set, skipping retention run');
        return;
    }

    const url = new URL('/api/config', apiUrl);
    url.searchParams.set('keys', 'retention::enabled,retention::connection-feature::enabled,retention::chat::enabled,retention::import::enabled');

    const res = await fetch(url, {
        headers: {
            Authorization: `Bearer ${jwt.sign({ access: 'admin', email: 'system' }, signingSecret, { expiresIn: '5m' })}`,
        }
    });

    if (!res.ok) throw new Error(`Failed to fetch config: HTTP ${res.status}`);

    const config = await res.json() as RetentionTaskConfig;

    if (config['retention::enabled'] === false) {
        console.log('ok - retention is disabled, skipping run');
        return;
    }

    for (const task of tasks) {
        if (task.enabled && !task.enabled(config)) continue;

        const start = Date.now();
        try {
            const result = await task.run();
            console.log(`ok - task:${task.name}: ${result.deleted} deleted in ${Date.now() - start}ms`);
        } catch (err) {
            console.error(`error - task:${task.name} failed:`, err);
        }
    }

    console.log('ok - retention run complete');
}

if (process.argv.includes('--run-once')) {
    try {
        await runOnce();
        process.exit(0);
    } catch (err) {
        console.error('error - retention run failed:', err);
        process.exit(1);
    }
} else {
    const schedule = process.env.RETENTION_SCHEDULE || '0 3 * * *';

    if (!cron.validate(schedule)) throw new Error(`Invalid RETENTION_SCHEDULE: ${schedule}`);

    const task = cron.schedule(schedule, async () => {
        try {
            await runOnce();
        } catch (err) {
            console.error('error - retention cron run failed:', err);
        }
    }, { timezone: process.env.TZ || 'UTC' });

    process.on('SIGTERM', () => { task.stop(); process.exit(0); });
    process.on('SIGINT', () => { task.stop(); process.exit(0); });

    console.log(`ok - retention scheduler started: ${schedule}`);
}
