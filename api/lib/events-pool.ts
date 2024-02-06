import Schedule from './schedule.js';
import Bree from 'bree';
import { Layer } from './schema.js';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { type InferSelectModel } from 'drizzle-orm';
import Modeler from '@openaddresses/batch-generic';
import * as pgtypes from './schema.js'

/**
 * Maintain a pool of Events - this pool handles second level
 * events which are not supported by the preferred EventBridge
 *
 * @class
 */
export default class EventsPool {
    stackName: string;
    bree: Bree;

    constructor(stackName: string) {
        this.stackName = stackName;

        this.bree = new Bree({
            root: false,
            jobs: [],
            errorHandler: (error, workerMetadata) => {
                if (workerMetadata.threadId) {
                    console.error(`ERROR: There was an error while running a worker ${workerMetadata.name} with thread ID: ${workerMetadata.threadId}`)
                    console.error(error);
                } else {
                    console.error(`ERROR: There was an error while running a worker ${workerMetadata.name}`)
                    console.error(error);
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
        const layers: InferSelectModel<typeof Layer>[] = [];

        const stream = await LayerModel.stream();

        await this.bree.start();

        return new Promise((resolve) => {
            stream.on('data', (layer: InferSelectModel<typeof Layer>) => {
                if (layer.cron && Schedule.is_aws(layer.cron)) return;

                if (!layer.enabled) return;
                layers.push(layer);
            }).on('end', async () => {
                for (const layer of layers) {
                    try {
                        if (layer.cron) this.add(layer.id, layer.cron);
                    } catch (err) {
                        console.error(err);
                    }
                }

                return resolve();
            });
        });
    }

    async add(layerid: number, cron: string) {
        const name = `layer-${layerid}`;
        console.error(`ok - adding layer ${layerid} @ ${cron}`);

        const parsed = Schedule.parse_rate(cron);
        await this.delete(layerid);
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
    }

    async delete(layerid: number) {
        try {
            const name = `layer-${layerid}`;
            await this.bree.remove(name);
        } catch (err) {
            // This usually only happens when a job is added that doesn't exist yet
        }
    }
}
