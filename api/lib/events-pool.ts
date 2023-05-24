// @ts-ignore
import Layer from './types/layer.js';
import Schedule from './schedule.js';
// @ts-ignore
import { Pool } from '@openaddresses/batch-schema';
import Bree from 'bree';

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
     * @param pool        Postgres Pol
     */
    async init(pool: Pool): Promise<void> {
        const layers: Layer[] = [];

        const stream = await Layer.stream(pool);

        await this.bree.start();

        return new Promise((resolve) => {
            stream.on('data', (layer: Layer) => {
                if (Schedule.is_aws(layer.cron)) return;

                if (!layer.enabled) return;
                layers.push(layer);
            }).on('end', async () => {
                for (const layer of layers) {
                    try {
                        this.add(layer.id, layer.cron);
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
            path: (new URL('../jobs/lambda.js', import.meta.url)).pathname,
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
