import Schedule from './schedule.js';
import Bree from 'bree';
import { randomUUID } from 'node:crypto';
import { Layer } from './schema.js';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { type InferSelectModel } from 'drizzle-orm';
import Modeler from '@openaddresses/batch-generic';
import type * as pgtypes from './schema.js'

/**
 * Maintain a pool of Events - this pool handles second level
 * events which are not supported by the preferred EventBridge
 *
 * @class
 */
export default class EventsPool {
    jobs: Map<number, string>;
    stackName: string;
    bree: Bree;

    constructor(stackName: string) {
        this.stackName = stackName;

        this.jobs = new Map();

        this.bree = new Bree({
            root: false,
            jobs: [],
            errorHandler: (error, workerMetadata) => {
                if (workerMetadata.threadId) {
                    console.error(`ERROR: There was an error while running a worker ${workerMetadata.name} with thread ID: ${workerMetadata.threadId}`, error)
                } else {
                    console.error(`ERROR: There was an error while running a worker ${workerMetadata.name}`, error)
                }
            }
        })
    }

    /**
     * Page through layers and add events as needed
     *
     * @param pool        Postgres Pool
     */
    async init(pool: PostgresJsDatabase<typeof pgtypes>): Promise<void> {
        const LayerModel = new Modeler(pool, Layer);
        const layers: Map<number, InferSelectModel<typeof Layer>> = new Map();

        const stream = await LayerModel.stream();

        await this.bree.start();

        await new Promise((resolve) => {
            stream.on('data', (layer: InferSelectModel<typeof Layer>) => {
                if (
                    (layer.cron && Schedule.is_aws(layer.cron))
                    || !layer.enabled
                ) return;

                layers.set(layer.id, layer);
            }).on('end', resolve);
        });

        for (const layer of layers.values()) {
            try {
                this.add(layer.id, layer.cron);
            } catch (err) {
                console.error(`CloudTAK Bree: Init Error on Layer ${layer.id}`, err);
            }
        }
    }

    async add(layerid: number, cron: string) {
        const name = `layer-${layerid}-${randomUUID()}`;
        console.error(`ok - adding layer ${layerid} @ ${cron}`);

        try {
            const exist = this.jobs.get(layerid);

            if (exist) {
                await this.delete(exist);
            }
        } catch (err) {
            console.error('CloudTAK Bree: Failed to remove existing job', err);
        }

        this.jobs.set(layerid, name);

        try {
            const parsed = Schedule.parse_rate(cron);

            await this.bree.add({
                name,
                path: (new URL('./jobs/lambda.js', import.meta.url)).pathname,
                interval: `${parsed.freq} ${parsed.unit}`,
                worker: {
                    workerData: {
                        LayerID: layerid,
                        StackName: this.stackName
                    }
                }
            });

            await this.bree.start(name);
        } catch (err) {
            console.error(`CloudTAK Bree: Add Error on Layer ${layerid}`, err);
            throw err;
        }
    }

    async delete(name: string | number) {
        if (typeof name === 'number') {
            name = this.jobs.get(name) || '';
        }

        try {
            if (name) {
                this.bree.stop(name);
                await this.bree.remove(name);
            }
        } catch (err) {
            console.log(`CloudTAK Bree: ${name} does not yet exist and cannot be removed`, err);
        }
    }
}
