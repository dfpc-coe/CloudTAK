import { Static, Type } from '@sinclair/typebox'
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import { Feature } from '@tak-ps/node-cot'
import { HistoryOptions } from '@tak-ps/node-tak/lib/api/query';
import Auth from '../lib/auth.js';
import Config from '../lib/config.js';
import { ExportInput } from '@tak-ps/node-tak/lib/api/export';
import { TAKAPI, APIAuthCertificate, } from '@tak-ps/node-tak';

export default async function router(schema: Schema, config: Config) {
    await schema.post('/marti/export', {
        name: 'KML Export',
        group: 'MartiExport',
        description: 'Helper API to export Timeseries KML data from TAK',
        query: Type.Object({
            download: Type.Optional(Type.Boolean()),
        }),
        body: ExportInput
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req, { admin: true });

            const auth = config.serverCert();
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

            const exp = await api.Export.export(req.body);

            if (req.query.download) {
                res.setHeader('Content-Disposition', `attachment; filename="export.${req.body.format}"`);
            }

            exp.pipe(res);
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.get('/marti/cot/:uid', {
        name: 'COT Latest',
        group: 'MartiCOTQuery',
        description: 'Helper API to get latest COT by UID',
        params: Type.Object({
            uid: Type.String()
        }),
        res: Feature.Feature
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            const profile = await config.models.Profile.from(user.email);
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(profile.auth.cert, profile.auth.key));

            const feat = await api.Query.singleFeat(req.params.uid);

            res.json(feat)
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.get('/marti/cot/:uid/all', {
        name: 'COT History',
        group: 'MartiCOTQuery',
        description: 'Helper API to list COT history',
        params: Type.Object({
            uid: Type.String()
        }),
        query: Type.Composite([
            Type.Object({
                track: Type.Boolean({
                    description: 'By default each historic point will be its own feature, if true this will attempt to join all points into a single Feature Collection at the cost of temporal attributes',
                    default: true
                })
            }),
            HistoryOptions
        ]),
        res: Type.Object({
            type: Type.String(),
            features: Type.Array(Feature.Feature)
        })
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            const profile = await config.models.Profile.from(user.email);
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(profile.auth.cert, profile.auth.key));

            const feats = await api.Query.historyFeats(req.params.uid, {
                start: req.query.start,
                end: req.query.end,
                secago: req.query.secago,
            });

            let features: Array<Static<typeof Feature.Feature>> = [];

            if (req.query.track) {
                let composite: Static<typeof Feature.Feature> | undefined = undefined;

                for (const feat of feats) {
                    if (feat.geometry.type !== 'Point') {
                        features.push(feat);
                    } else if (composite === undefined) {
                        composite = feat;
                        composite.id = `${composite.id}-track`;
                        composite.geometry = {
                            type: 'LineString',
                            // @ts-expect-error Need to be more explicit with Geometry Defs to lock point to number[]
                            coordinates: [ composite.geometry.coordinates ]
                        }
                    } else if (feat.geometry.coordinates[0] !== 0 && feat.geometry.coordinates[1]) {
                        // @ts-expect-error Need to be more explicit with Geometry Defs to lock point to number[]
                        composite.geometry.coordinates.push(feat.geometry.coordinates);
                    }
                }

                if (composite) features.push(composite);
            } else {
                features = feats;
            }

            res.json({
                type: 'FeatureCollection',
                features
            });
        } catch (err) {
             Err.respond(err, res);
        }
    });
}
