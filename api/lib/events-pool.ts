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
    bree: Bree;

    constructor() {
        this.bree = new Bree({});
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

                        const name = `layer-${layer.id}`;
                        await this.bree.add({
                            name,
                            interval: layer.data.cron,
                            path: EventsPool.QueueLambda
                        });
                        await this.bree.start(layer);
                    } catch (err) {
                        console.error(err);
                    }
                }

                return resolve();
            });
        });
    }

    static async QueueLambda() {
        console.error(this);
    }

    async add(conn: any) {
    }

    delete(id: number): boolean {
        return true;
    }
}
