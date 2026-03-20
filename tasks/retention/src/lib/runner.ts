export interface RetentionContext {
    dryRun: boolean;
    source: string;
    startedAt: Date;
    logger: Console;
    env: NodeJS.ProcessEnv;
}

export interface RetentionTaskResult {
    name: string;
    status: 'success' | 'error';
    scanned: number;
    deleted: number;
    duration: number;
    message?: string;
    dryRun: boolean;
}

export interface RetentionTask {
    name: string;
    run: (context: RetentionContext) => Promise<RetentionTaskResult>;
}

export interface RetentionSummary {
    source: string;
    startedAt: string;
    completedAt: string;
    duration: number;
    dryRun: boolean;
    taskCount: number;
    failed: number;
    deleted: number;
    results: RetentionTaskResult[];
}

import tasks from '../tasks/index.js';

let activeRun: Promise<RetentionSummary> | undefined;

export function isRunning(): boolean {
    return !!activeRun;
}

export function hasRetentionErrors(summary: RetentionSummary): boolean {
    return summary.failed > 0;
}

export async function runRetention(opts: {
    dryRun?: boolean;
    source?: string;
} = {}): Promise<RetentionSummary> {
    if (activeRun) return activeRun;

    const startedAt = new Date();
    const dryRun = opts.dryRun ?? false;
    const source = opts.source ?? 'manual';

    activeRun = (async () => {
        const results: RetentionTaskResult[] = [];

        for (const task of tasks) {
            const taskStart = Date.now();

            try {
                const result = await task.run({
                    dryRun,
                    source,
                    startedAt,
                    logger: console,
                    env: process.env,
                });

                results.push({
                    ...result,
                    name: result.name || task.name,
                    duration: result.duration || (Date.now() - taskStart),
                    dryRun,
                });
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                console.error(`error - retention task ${task.name} failed:`, err);
                results.push({
                    name: task.name,
                    status: 'error',
                    scanned: 0,
                    deleted: 0,
                    duration: Date.now() - taskStart,
                    message,
                    dryRun,
                });
            }
        }

        const completedAt = new Date();
        const summary: RetentionSummary = {
            source,
            startedAt: startedAt.toISOString(),
            completedAt: completedAt.toISOString(),
            duration: completedAt.getTime() - startedAt.getTime(),
            dryRun,
            taskCount: results.length,
            failed: results.filter((result) => result.status === 'error').length,
            deleted: results.reduce((sum, result) => sum + result.deleted, 0),
            results,
        };

        console.log('ok - retention run complete', summary);

        return summary;
    })();

    try {
        return await activeRun;
    } finally {
        activeRun = undefined;
    }
}
