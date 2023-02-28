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
                } else {
                    console.error(`ERROR: There was an error while running a worker ${workerMetadata.name}`)
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

                        this.add(layer);
                    } catch (err) {
                        console.error(err);
                    }
                }

                return resolve();
            });
        });
    }

    async add(layer: any) {
        const name = `layer-${layer.id}`;
        console.error(`ok - adding layer ${layer.id} @ ${layer.data.cron}`);

        const parsed = Schedule.parse_rate(layer.data.cron);
        await this.bree.add({
            name,
            path: (new URL('../jobs/lambda.js', import.meta.url)).pathname,
            interval: `${parsed.freq} ${parsed.unit}`,
            worker: {
                workerData: {
                    LayerID: layer.id,
                    StackName: this.stackName
                }
            }
        });
        await this.bree.start(name);
    }

    delete(layer: any) {
        const name = `layer-${layer.id}`;
        this.bree.remove(name);
    }
}
