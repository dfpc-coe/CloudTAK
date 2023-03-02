// @ts-ignore
import LayersLive from './types/layers_live.js';
// @ts-ignore
import Layer from './types/layer.js';
import Schedule from './schedule.js';
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
     * @param {Pool}    pool        Postgres Pol
     */
    async init(pool: any): Promise<void> {
        const layers: any[] = [];

        const stream = await LayersLive.stream(pool);

        await this.bree.start();

        return new Promise((resolve) => {
            stream.on('data', (layerlive: any) => {
                if (Schedule.is_aws(layerlive.cron)) return;

                layers.push(async () => {
                    const layer = await Layer.from(pool, layerlive.layer_id);
                    if (!layer.enabled) return;
                    layer.data = layerlive;
                    return layer;
                });
            }).on('end', async () => {
                for (const layerfn of layers) {
                    try {
                        const layer = await layerfn();
                        if (!layer) return;

                        this.add(layer.id, layer.data.cron);
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
