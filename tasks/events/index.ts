import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import EventJob from './src/job.js';
import S3 from "@aws-sdk/client-s3";
import type { ImportList } from './src/types.js';
import { Worker } from 'node:worker_threads';
import { includesWithGlob } from "array-includes-with-glob";
import { pipeline } from 'node:stream/promises';
import Import from './src/import.js';
import jwt from 'jsonwebtoken';
import API from './src/api.js';

export default class WorkerPool {
    interval: ReturnType<typeof setInterval>;

    api: string;
    secret: string;

    maxWorkes: number;
    workers: Set<{
        worker: unknown,
        job: Job
    }>;

    constructor(opts: {
        api: string
        secret: string,
        interval: number
    }) {
        this.maxWorkers = os.availableParallelism();
        console.log(`ok - Worker Pool started with ${this.maxWorkers} workers`);

        this.api = opts.api;
        this.secret = opts.secret;

        this.workers = new Set();

        // TODO monitor for SIGKILL? (check ECS docs) and return tasks on deployment

        this.interval = setInterval(async () => {
            // Don't pick up new work if we are already maxed out
            if (this.workers.size === this.maxWorkers) return;

            console.log('ok - Polling for new work');

            try {
                const jobs = await this.poll();

                for (const job of jobs) {
                    console.error(job);
                }
            } catch (err) {
                console.error('error - Failed to poll for new work:', err);
            }
        }, opts.interval);
    }

    async lock(import: number): Promise<boolean> {
        const url = new URL(`/api/jobs`, this.api);

        const res = await fetch(new URL(`/api/import/${import}`, this.api), {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer etl.${jwt.sign({ access: 'import', id: import, internal: true }, this.secret)}`,
            },
            body: JSON.stringify({
                status: 'Processing'
            })
        });

        if (!res.ok) throw new Error(await json.text());

        return true;
    }

    /**
     * Poll the CloudTAK API To look for new work
     *
     * @param jobs Number of Job Slots available
     */
    async poll(jobs: number): Promise<Array<Job<unknown>>> {
        if (jobs === 0) return [];

        const url = new URL(`/api/jobs`, this.api);

        url.searchParams.set('limit', String(jobs));
        url.searchParams.set('status', 'Pending');

        const res = await fetch(new URL(`/api/import`, this.api), {
            method: 'GET',
            headers: {
                'Authorization': `Bearer etl.${jwt.sign({ access: 'import', internal: true }, this.secret)}`,
            },
        });

        if (!res.ok) throw new Error(await json.text());

        const json = await res.json() as ImportList;
        return json.items;
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    if (!process.env.SigningSecret) throw new Error('SigningSecret environment variable is required');

    const pool = new WorkerPool({
        api: process.env.TAK_ETL_API || 'http://localhost:5001',
        secret: process.env.SigningSecret,
        interval: 1000
    });


    /**
    console.log(`ok - New file detected in s3://${md.Bucket}/${md.Key}`);
    if (md.Key.startsWith('import/')) {
        await Import(md);
    } else if (md.Key.startsWith('data/')) {
        md.ID = path.parse(md.Key).dir.replace('data/', '');
        md.Token = `etl.${jwt.sign({ access: 'data' , id: parseInt(md.ID), internal: true }, String(process.env.SigningSecret))}`;

        const data = await API.fetchData(md);

        if (data.mission_sync && !['.geojsonld', '.pmtiles'].includes(md.Ext)) {
            let sync = false;
            for (const glob of data.assets) {
                sync = includesWithGlob([md.Name], glob);
                if (sync) break;
            }

            if (sync) {
                console.log(`ok - Data ${md.Key} syncing with ${data.name}`);
                const s3 = new S3.S3Client({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
                await pipeline(
                    // @ts-expect-error 'StreamingBlobPayloadOutputTypes | undefined' is not assignable to parameter of type 'ReadableStream'
                    (await s3.send(new S3.GetObjectCommand({
                        Bucket: md.Bucket,
                        Key: md.Key
                    }))).Body,
                    fs.createWriteStream(md.Local)
                );

                console.log(`ok - Data ${md.Key} posting to mission ${data.name}`);
                const res = await API.uploadDataMission(md, {
                    filename: md.Name,
                    connection: data.connection
                });

                console.log(JSON.stringify(res));
            } else {
                console.log(`ok - Data ${md.Key} does not match mission sync globs`);
            }
        } else {
            console.log(`ok - Data ${md.Key} has no mission assigned or is a geojsonld or pmtiles file`);
        }

        if (data.auto_transform) {
            await API.transformData(md, {
                connection: data.connection
            });
        } else {
            console.log(`ok - Data ${md.ID} has auto-transform turned off`);
        }
    } else if (md.Key.startsWith('profile/')) {
        console.error('Ignoring Profile Imports as these are handled programatically');
    } else {
        throw new Error('Unknown Import Type');
    }
    */
}
