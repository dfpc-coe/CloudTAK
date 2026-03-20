import cron from 'node-cron';
import { hasRetentionErrors, runRetention } from './lib/runner.js';

if (!process.env.AWS_REGION) process.env.AWS_REGION = 'us-east-1';
if (!process.env.RETENTION_SCHEDULE) process.env.RETENTION_SCHEDULE = '0 3 * * *';

async function runOnce(source: string): Promise<number> {
    try {
        const summary = await runRetention({ source });

        if (hasRetentionErrors(summary)) {
            console.error('error - retention run completed with task failures', summary);
            return 1;
        }

        return 0;
    } catch (err) {
        console.error('error - retention run failed', err);
        return 1;
    }
}

function startScheduler(): void {
    const schedule = process.env.RETENTION_SCHEDULE || '0 3 * * *';

    if (!cron.validate(schedule)) {
        throw new Error(`Invalid RETENTION_SCHEDULE: ${schedule}`);
    }

    const task = cron.schedule(schedule, async () => {
        try {
            const summary = await runRetention({ source: 'cron' });

            if (hasRetentionErrors(summary)) {
                console.error('error - retention cron run completed with task failures', summary);
            }
        } catch (err) {
            console.error('error - retention cron run failed', err);
        }
    }, {
        timezone: process.env.TZ || 'UTC'
    });

    process.on('SIGTERM', () => {
        task.stop();
        console.log('ok - retention scheduler stopped');
        process.exit(0);
    });

    process.on('SIGINT', () => {
        task.stop();
        console.log('ok - retention scheduler stopped');
        process.exit(0);
    });

    console.log(`ok - retention scheduler started: ${schedule}`);
}

if (process.argv.includes('--run-once')) {
    process.exit(await runOnce('run-task'));
} else {
    startScheduler();
}
