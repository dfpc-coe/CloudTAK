import AWSLambda from '@aws-sdk/client-lambda';
import Schedule from './schedule.js';
import { Layer } from './schema.js';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { type InferSelectModel } from 'drizzle-orm';
import Modeler from '@openaddresses/batch-generic';
import type * as pgtypes from './schema.js'

const lambda = new AWSLambda.LambdaClient({ region: process.env.AWS_REGION });

/**
 * Maintain a pool of Events - this pool handles second level
 * events which are not supported by the preferred EventBridge
 *
 * @class
 */
export default class EventsPool {
    jobs: Map<number, ReturnType<typeof setInterval>>;
    stackName: string;

    constructor(stackName: string) {
        this.stackName = stackName;

        this.jobs = new Map();
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
                if (layer.cron) {
                    this.add(layer.id, layer.cron);
                }
            } catch (err) {
                console.error(`CloudTAK Cron: Init Error on Layer ${layer.id}`, err);
            }
        }
    }

    async add(layerid: number, cron: string) {
        console.error(`ok - adding layer ${layerid} @ ${cron}`);

        try {
            await this.delete(layerid);
        } catch (err) {
            console.error('CloudTAK EventPool: Failed to remove existing job', err);
        }

        try {
            // All Units should be seconds here
            const parsed = Schedule.parse_rate(cron);

            this.jobs.set(layerid, setInterval(async () => {
                console.log(`Invoking Layer ${layerid}: ${this.stackName}-layer-${layerid}`);
                await lambda.send(new AWSLambda.InvokeCommand({
                    FunctionName: `${this.stackName}-layer-${layerid}`,
                    InvocationType: 'Event',
                    Payload: Buffer.from(JSON.stringify({
                        type: 'default'
                    }))
                }));
            }, parsed.freq * 1000));
        } catch (err) {
            console.error(`CloudTAK EventPool: Add Error on Layer ${layerid}`, err);
            throw err;
        }
    }

    async delete(layerid: number) {
        try {
            const interval = this.jobs.get(layerid);
            if (interval) clearInterval(interval);
        } catch (err) {
            console.log(`CloudTAK EventPool: ${layerid} does not yet exist and cannot be removed`, err);
            throw err;
        }
    }
}

