import cron from 'node-cron';
import jwt from 'jsonwebtoken';

import tasks from './tasks/index.js';

export interface RetentionTaskResult {
    name: string;
    status: 'success' | 'error';
    scanned: number;
    deleted: number;
    duration: number;
    message?: string;
}

export interface RetentionTask {
    name: string;
    run: () => Promise<RetentionTaskResult>;
}

async function runOnce(): Promise<void> {
    const apiUrl = process.env.API_URL;
    const signingSecret = process.env.SigningSecret;

    if (!apiUrl || !signingSecret) {
        console.log('ok - API_URL or SigningSecret not set, skipping retention run');
        return;
    }

    const res = await fetch(new URL('/api/config?keys=retention::enabled', apiUrl), {
        headers: {
            Authorization: `Bearer ${jwt.sign({ access: 'admin', email: 'system' }, signingSecret)}`,
        }
    });

    if (!res.ok) throw new Error(`Failed to fetch config: HTTP ${res.status}`);

    const config = await res.json() as { 'retention::enabled'?: boolean };

    if (config['retention::enabled'] === false) {
        console.log('ok - retention is disabled, skipping run');
        return;
    }

    for (const task of tasks) {
        const start = Date.now();
        try {
            const result = await task.run();
            console.log(`ok - task:${task.name}: ${result.scanned} scanned, ${result.deleted} deleted in ${Date.now() - start}ms`);
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
