import { Type } from '@sinclair/typebox'
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth, { AuthResourceAccess } from '../lib/auth.js';
import Config from '../lib/config.js';
import { sql } from 'drizzle-orm';

export default async function router(schema: Schema, config: Config) {
    await schema.put('/connection/:connectionid/layer/:layerid/incoming/ephemeral', {
        name: 'Incoming Ephemeral',
        group: 'LayerEphemeral',
        description: 'Store ephemeral values',
        params: Type.Object({
            connectionid: Type.Integer({ minimum: 1 }),
            layerid: Type.Integer({ minimum: 1 }),
        }),
        body: Type.Record(Type.String(), Type.String()),
        res: Type.Record(Type.String(), Type.String())
    }, async (req, res) => {
        try {
            const { connection } = await Auth.is_connection(config, req, {
                resources: [
                    { access: AuthResourceAccess.CONNECTION, id: req.params.connectionid },
                    { access: AuthResourceAccess.LAYER, id: req.params.layerid }
                ]
            }, req.params.connectionid);

            const layer =  await config.models.Layer.augmented_from(req.params.layerid)

            if (layer.connection !== connection.id) {
                throw new Err(400, null, 'Layer does not belong to this connection');
            } else if (!layer.incoming) {
                throw new Err(400, null, 'Layer does not have incoming config');
            }

            const incoming = await config.models.LayerIncoming.commit(req.params.layerid, {
                updated: sql`Now()`,
                ephemeral: req.body
            });

            await config.cacher.del(`layer-${req.params.layerid}`);

            res.json(incoming.ephemeral)
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.put('/connection/:connectionid/layer/:layerid/outgoing/ephemeral', {
        name: 'Outgoing Ephemeral',
        group: 'LayerEphemeral',
        description: 'Store ephemeral values',
        params: Type.Object({
            connectionid: Type.Integer({ minimum: 1 }),
            layerid: Type.Integer({ minimum: 1 }),
        }),
        body: Type.Record(Type.String(), Type.String()),
        res: Type.Record(Type.String(), Type.String())
    }, async (req, res) => {
        try {
            const { connection } = await Auth.is_connection(config, req, {
                resources: [
                    { access: AuthResourceAccess.CONNECTION, id: req.params.connectionid },
                    { access: AuthResourceAccess.LAYER, id: req.params.layerid }
                ]
            }, req.params.connectionid);

            const layer =  await config.models.Layer.augmented_from(req.params.layerid)

            if (layer.connection !== connection.id) {
                throw new Err(400, null, 'Layer does not belong to this connection');
            } else if (!layer.outgoing) {
                throw new Err(400, null, 'Layer does not have outgoing config');
            }

            const outgoing = await config.models.LayerOutgoing.commit(req.params.layerid, {
                updated: sql`Now()`,
                ephemeral: req.body
            });

            await config.cacher.del(`layer-${req.params.layerid}`);

            res.json(outgoing.ephemeral)
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
