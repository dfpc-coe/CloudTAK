import os from 'node:os';
import type { Import, ImportList } from './src/types.js';
import { Worker } from 'node:worker_threads';
import Import from './src/import.js';
import jwt from 'jsonwebtoken';

export default class WorkerPool {
    interval: ReturnType<typeof setInterval>;

    api: string;
    secret: string;

    bucket: string;

    maxWorkes: number;
    workers: Set<{
        worker: Worker,
        job: Import
    }>;

    constructor(opts: {
        api: string
        secret: string,
        bucket: string,
        interval: number
    }) {
        this.maxWorkers = os.availableParallelism();
        console.log(`ok - Worker Pool started with ${this.maxWorkers} workers`);

        this.api = opts.api;
        this.secret = opts.secret;

        this.bucket = opts.bucket;

        this.workers = new Set();

        // TODO monitor for SIGKILL? (check ECS docs) and return tasks on deployment

        this.interval = setInterval(async () => {
            // Don't pick up new work if we are already maxed out
            if (this.workers.size >= this.maxWorkers) return;

            console.log('ok - Polling for new work');

            try {
                const jobs = await this.poll(this.maxWorkers - this.workers.size);

                for (const job of jobs) {
                    await this.lock(job.id)

                    const worker = new Worker(new URL('./src/worker.ts', import.meta.url))
                    const locked = { job, worker }

                    worker.on('message', (message) => {
                        if (message.type === 'success') {
                            await this.success(job.id);
                        } else if (message.type === 'error') {
                            await this.error(job.id, message.error);
                        } else {
                            console.error('Unknown message type from worker:', message);
                        }
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

    async lock(importid: number): Promise<boolean> {
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

        return true;
    }

    async error(importid: number, error: string): Promise<boolean> {
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
}

if (import.meta.url === `file://${process.argv[1]}`) {
    if (!process.env.SigningSecret) throw new Error('SigningSecret environment variable is required');
    if (!process.env.AssetBucket) throw new Error('AssetBucket environment variable is required');

    new WorkerPool({
        api: process.env.TAK_ETL_API || 'http://localhost:5001',
        secret: process.env.SigningSecret,
        bucket: process.env.AssetBucket,
        interval: 1000
    });
}
