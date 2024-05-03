import { Type } from '@sinclair/typebox'
import Alarm from '../lib/aws/alarm.js';
import Cacher from '../lib/cacher.js';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth, { AuthResourceAccess } from '../lib/auth.js';
import Config from '../lib/config.js';
import DataMission from '../lib/data-mission.js';
import { DataResponse, LayerResponse } from '../lib/types.js';

export default async function router(schema: Schema, config: Config) {
    const alarm = new Alarm(config.StackName);

    await schema.get('/data/:dataid', {
        private: true,
        name: 'Get Data',
        group: 'Internal',
        description: `
            Events don't have the Connection ID but they have a valid data token
            This API allows a data token to request the data object and obtain the
            connection ID for subsequent calls
        `,
        params: Type.Object({
            dataid: Type.Integer()
        }),
        res: DataResponse
    }, async (req, res) => {
        try {
            await Auth.as_resource(config, req, {
                resources: [
                    { access: AuthResourceAccess.DATA, id: req.params.dataid }
                ]
            });

            const data = await config.models.Data.from(req.params.dataid);

            try {
                await DataMission.sync(config, data);
            } catch (err) {
                return res.json({
                    mission_exists: false,
                    mission_error: err instanceof Error ? err.message : String(err),
                    ...data
                });
            }

            return res.json({
                mission_exists: true,
                ...data
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/layer/:layerid', {
        name: 'Get Layer',
        group: 'Internal',
        description: `
            Events don't have the Connection ID but they have a valid data token
            This API allows a layer token to request the layer object and obtain the
            connection ID for subsequent calls
        `,
        params: Type.Object({
            layerid: Type.Integer(),
        }),
        res: LayerResponse
    }, async (req, res) => {
        try {
            await Auth.as_resource(config, req, {
                resources: [
                    { access: AuthResourceAccess.LAYER, id: req.params.layerid }
                ]
            });

            const layer = await config.cacher.get(Cacher.Miss(req.query, `layer-${req.params.layerid}`), async () => {
                return await config.models.Layer.from(req.params.layerid);
            });

            return res.json({
                status: config.StackName !== 'test' ? await alarm.get(layer.id) : 'unknown',
                ...layer
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
