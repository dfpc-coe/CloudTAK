import Err from '@openaddresses/batch-error';
import { Static } from '@sinclair/typebox'
import {InferSelectModel} from 'drizzle-orm';
import { Connection } from '../schema.js';
import Alarm from '../aws/alarm.js';
import type { InferInsertModel } from 'drizzle-orm';
import Lambda from '../aws/lambda.js';
import ECR from '../aws/ecr.js';
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

    async from(
        connection: InferSelectModel<typeof Connection> | number,
        layerid: number
    ): Promise<Static<typeof LayerResponse>> {
        if (typeof connection === 'number') {
            connection = await this.config.models.Connection.from(connection);
        }

        if (connection.readonly) throw new Err(400, null, 'Connection is Read-Only mode');

        const layer = await this.config.models.Layer.augmented_from(layerid);

        if (layer.connection !== connection.id) {
            throw new Err(400, null, 'Layer does not belong to this connection');
        }

        return layer;
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

        // name-v<major>.<minor>.<patch>
        if (!input.task || !input.task.match(/^(.+)-v(\d+)\.(\d+)\.(\d+)$/)) {
            throw new Err(400, null, 'Layer Task must be in the format name-v<major>.<minor>.<patch>');
        } else if (!await ECR.exists(input.task)) {
            throw new Err(400, null, `Layer Task ${input.task} does not exist in AWS Container Registry`);
        }

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
