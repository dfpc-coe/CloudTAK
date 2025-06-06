import { Static } from '@sinclair/typebox'
import Alarm from '../aws/alarm.js';
import type { InferInsertModel } from 'drizzle-orm';
import Lambda from '../aws/lambda.js';
import CloudFormation from '../aws/cloudformation.js';
import Config from '../config.js';
import { LayerResponse } from '../types.js';
import { Layer, LayerIncoming, LayerOutgoing } from '../schema.js';

export default class LayerControl {
    config: Config;
    alarm: Alarm;

    constructor(config: Config) {
        this.config = config;
        this.alarm = new Alarm(config.StackName);
    }

    async generate(
        input: InferInsertModel<typeof Layer>,
        opts?: {
            alarms?: boolean,
            incoming?: Omit<InferInsertModel<typeof LayerIncoming>, "layer">,
            outgoing?: Omit<InferInsertModel<typeof LayerOutgoing>, "layer">
        }
    ): Promise<Static<typeof LayerResponse>> {
        const base = await this.config.models.Layer.generate(input);

        if (opts && opts.incoming) {
            await this.config.models.LayerIncoming.generate({
                ...opts.incoming,
                layer: base.id,
            });
        }


        if (opts && opts.outgoing) {
            await this.config.models.LayerOutgoing.generate({
                ...opts.outgoing,
                layer: base.id,
            });
        }

        const layer = await this.config.models.Layer.augmented_from(base.id);

        try {
            const stack = await Lambda.generate(this.config, layer);
            await CloudFormation.create(this.config, layer.id, stack);
        } catch (err) {
            console.error(err);
        }

        let status = 'unknown';
        if (this.config.StackName !== 'test' && opts && opts.alarms === true) {
            try {
                status = await this.alarm.get(layer.id);
            } catch (err) {
                console.error(err);
            }
        }

        return {
            status,
            ...layer
        }
    }
}
