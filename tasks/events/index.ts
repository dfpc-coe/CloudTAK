import os from 'node:os';
import type { Import, ImportList } from './src/types.js';
import EventEmitter from 'node:events';
import { Worker } from 'node:worker_threads';
import jwt from 'jsonwebtoken';

export default class WorkerPool extends EventEmitter {
    interval: NodeJS.Timer;

    isClosing: boolean;

    api: string;
    secret: string;

    bucket: string;

    maxWorkers: number;
    workers: Set<{
        worker: Worker,
        job: Import
    }>;

    constructor(opts: {
        api: string
        secret: string,
        bucket: string,
        interval: number

        maxWorkers?: number;
    }) {
        super();

        this.maxWorkers = opts.maxWorkers || os.availableParallelism();
        console.log(`ok - Worker Pool started with ${this.maxWorkers} workers`);

        this.api = opts.api;
        this.secret = opts.secret;

        this.bucket = opts.bucket;

        this.workers = new Set();

        // TODO monitor for SIGKILL? (check ECS docs) and return tasks on deployment

        this.interval = setInterval(async () => {
            // Don't pick up new work if we are already maxed out
            if (this.workers.size >= this.maxWorkers) return;

            try {
                const jobs = await this.poll(this.maxWorkers - this.workers.size);

                for (let job of jobs) {
                    job = await this.lock(job.id)

                    this.emit('job', job);

                    const worker = new Worker(new URL('./src/comms.ts', import.meta.url))
                    const locked = { job, worker }

                    worker.on('message', async (message) => {
                        try {
                            if (message.type === 'success') {
                                await this.success(job.id);
                                console.log(`Import: ${job.id} - completed successfully`);
                            } else if (message.type === 'error') {
                                await this.error(job.id, message.error instanceof Error ? message.error.message : String(message.error));
                            } else {
                                console.error(`Import: ${job.id} -`, message);
                            }

                        } catch (err) {
                            console.error(`Import ${job.id} - failed to handle Job Finalization`, err);
                        }

                        worker.terminate()

                        this.workers.delete(locked);
                    });

                    this.workers.add(locked);

                    locked.worker.postMessage({
                        job: job,
                        api: this.api,
                        bucket: this.bucket,
                        secret: this.secret
                    });
                }
            } catch (err) {
                console.error('error - Failed to poll for new work:', err);
            }
        }, opts.interval);
    }

    async success(importid: number): Promise<boolean> {
        const res = await fetch(new URL(`/api/import/${importid}`, this.api), {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer etl.${jwt.sign({ access: 'import', id: importid, internal: true }, this.secret)}`,
            },
            body: JSON.stringify({
                status: 'Success'
            })
        });

        if (!res.ok) throw new Error(await res.text());

        return true;
    }

    async lock(importid: number): Promise<Import> {
        const res = await fetch(new URL(`/api/import/${importid}`, this.api), {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer etl.${jwt.sign({ access: 'import', id: importid, internal: true }, this.secret)}`,
            },
            body: JSON.stringify({
                status: 'Running'
            })
        });

        if (!res.ok) throw new Error(await res.text());

        return await res.json() as Import;
    }

    async error(
        importid: number,
        error: string
    ): Promise<boolean> {
        const res = await fetch(new URL(`/api/import/${importid}`, this.api), {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer etl.${jwt.sign({ access: 'import', id: importid, internal: true }, this.secret)}`,
            },
            body: JSON.stringify({
                status: 'Fail',
                error: error
            })
        });

        if (!res.ok) throw new Error(await res.text());

        return true;
    }

    /**
     * Poll the CloudTAK API To look for new work
     *
     * @param jobs Number of Job Slots available
     */
    async poll(jobs: number): Promise<Array<Import>> {
        if (jobs === 0) return [];

        const url = new URL(`/api/import`, this.api);

        url.searchParams.set('limit', String(jobs));
        url.searchParams.set('status', 'Pending');

        const res = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer etl.${jwt.sign({ access: 'import', internal: true }, this.secret)}`,
            },
        });

        if (!res.ok) throw new Error(await res.text());

        const json = await res.json() as ImportList;
        return json.items;
    }

    async close(): Promise<void> {
        this.isClosing = true;

        clearInterval(this.interval);

        await Promise.all(
            Array.from(this.workers)
                .map(({ worker }) => {
                    return new Promise<void>((resolve) => {
                        worker.on('exit', () => resolve());
                        worker.terminate();
                    })
                })
            );
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    if (!process.env.SigningSecret) throw new Error('SigningSecret environment variable is required');
    if (!process.env.ASSET_BUCKET) throw new Error('ASSET_BUCKET environment variable is required');

    new WorkerPool({
        api: process.env.API_URL || 'http://localhost:5001',
        secret: process.env.SigningSecret,
        bucket: process.env.ASSET_BUCKET,
        interval: 1000
    });
}
