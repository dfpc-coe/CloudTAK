import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import EventJob fom './src/job.js';
import S3 from "@aws-sdk/client-s3";
import { includesWithGlob } from "array-includes-with-glob";
import { pipeline } from 'node:stream/promises';
import Import from './src/import.js';
import jwt from 'jsonwebtoken';
import API from './src/api.js';

export default class WorkerPool {
    maxWorkes: number;
    workers: Set<{
        worker: unknown,
        job: Job
    }>;

    constructor(rate: string) {
        // Determine number of CPUs
        this.maxWorkers = 1;

        // node-cron
        () => {
            // Don't pick up new work if we are already maxed out
            if (set.size === this.maxWorkers) return;

            const jobs = await this.poll();

            for (const job of jobs) {
                // start worker thread
                this.workers.add({
                    worker: undefined,
                    job
                });
            }
        }
    }

    /**
     * Poll the CloudTAK API To look for new work
     *
     * @param jobs Number of Job Slots available
     */
    async poll(jobs: number): Array<Job<unknown>> {
        if (jobs === 0) return [];

    }
}

if (import.meta.url === `file://${process.argv[1]}`) {

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
}
