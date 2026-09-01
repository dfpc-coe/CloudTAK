import { Type } from '@sinclair/typebox';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth, { AuthResourceAccess } from '../../common/auth.js';
import type ConfigStateless from '../config.js';
import { HistoryOptions } from '@tak-ps/node-tak/lib/api/query';
import { Feature } from '@tak-ps/node-cot';
import CoreFeatureControl from '../lib/control/CoreFeature.js';
import { StandardLayerResponse } from '../../common/types.js';
import { TAKAPI, APIAuthCertificate } from '@tak-ps/node-tak';

export default async function router(schema: Schema, config: ConfigStateless) {
    const coreFeatureControl = new CoreFeatureControl(config);

    await schema.post('/layer/:layerid/cot', {
        name: 'Post COT',
        group: 'Internal',
        description: 'Post CoT data to a given layer',
        params: Type.Object({
            layerid: Type.Integer({ minimum: 1 }),
        }),
        query: Type.Object({
            logging: Type.Optional(Type.Boolean({ description: 'If logging is enabled for the layer, allow callers to skip logging for a particular CoT payload' })),
            archive: Type.Boolean({
                description: 'Save features to ConnectionFeature table',
                default: true,
            }),
        }),
        body: Type.Object({
            type: Type.Literal('FeatureCollection'),
            uids: Type.Optional(Type.Array(Type.String())),
            features: Type.Array(Feature.InputFeature),
        }),
        res: StandardLayerResponse,
    }, async (req, res) => {
        try {
            await Auth.as_resource(config, req, {
                resources: [{ access: AuthResourceAccess.LAYER, id: req.params.layerid }],
            });

            if (!req.headers['content-type']) throw new Err(400, null, 'Content-Type not set');

            const layer = await config.models.Layer.augmented_from(req.params.layerid);

            const errors = await coreFeatureControl.submit(layer, req.body.features, {
                uids: req.body.uids,
                archive: req.query.archive,
            });

            res.status(errors.length ? 400 : 200).json({
                status: errors.length ? 400 : 200,
                message: 'Submitted',
                errors,
            });
        } catch (err) {
            if (err instanceof Err && err.status === 200) {
                res.json({
                    status: 200,
                    message: err.message,
                    errors: [],
                });
            } else {
                Err.respond(err, res);
            }
        }
    });

    await schema.get('/connection/:connectionid/layer/:layerid/cot/:uid', {
        name: 'COT Latest',
        group: 'LayerCOTHistory',
        description: 'Helper API to get latest COT by UID',
        params: Type.Object({
            connectionid: Type.Integer(),
            layerid: Type.Integer(),
            uid: Type.String(),
        }),
        res: Feature.Feature,
    }, async (req, res) => {
        try {
            const { connection } = await Auth.is_connection(config, req, {
                resources: [
                    { access: AuthResourceAccess.CONNECTION, id: req.params.connectionid },
                    { access: AuthResourceAccess.LAYER, id: req.params.layerid },
                ],
            }, req.params.connectionid);

            if (connection.readonly) throw new Err(400, null, 'Connection is Read-Only mode');
            if (!connection.enabled) throw new Err(400, null, 'Connection is disabled');

            const layer = await config.models.Layer.augmented_from(req.params.layerid);

            if (!layer.connection) throw new Err(400, null, 'Layer is not attached to a Connection');
            if (layer.connection !== connection.id) throw new Err(400, null, 'Layer does not belong to this connection');

            const api = await TAKAPI.init(
                new URL(String(config.server.api)),
                new APIAuthCertificate(
                    connection.auth.cert,
                    connection.auth.key,
                ),
            );

            const feat = await api.Query.singleFeat(req.params.uid);

            res.json(feat);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/connection/:connectionid/layer/:layerid/cot/:uid/all', {
        name: 'COT History',
        group: 'LayerCOTHistory',
        description: 'Helper API to list COT history',
        params: Type.Object({
            connectionid: Type.Integer(),
            layerid: Type.Integer(),
            uid: Type.String(),
        }),
        query: HistoryOptions,
        res: Type.Object({
            type: Type.String(),
            features: Type.Array(Feature.Feature),
        }),
    }, async (req, res) => {
        try {
            const { connection } = await Auth.is_connection(config, req, {
                resources: [
                    { access: AuthResourceAccess.CONNECTION, id: req.params.connectionid },
                    { access: AuthResourceAccess.LAYER, id: req.params.layerid },
                ],
            }, req.params.connectionid);

            if (connection.readonly) throw new Err(400, null, 'Connection is Read-Only mode');
            if (!connection.enabled) throw new Err(400, null, 'Connection is disabled');

            const layer = await config.models.Layer.augmented_from(req.params.layerid);

            if (!layer.connection) throw new Err(400, null, 'Layer is not attached to a connection');
            if (layer.connection !== connection.id) throw new Err(400, null, 'Layer does not belong to this connection');

            const api = await TAKAPI.init(
                new URL(String(config.server.api)),
                new APIAuthCertificate(
                    connection.auth.cert,
                    connection.auth.key,
                ),
            );

            const features = await api.Query.historyFeats(req.params.uid, {
                start: req.query.start,
                end: req.query.end,
                secago: req.query.secago,
            });

            res.json({
                type: 'FeatureCollection',
                features,
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
