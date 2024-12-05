import { Type } from '@sinclair/typebox'
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import { Feature } from '@tak-ps/node-cot'
import { HistoryOptions } from '../lib/api/query.js';
import Auth from '../lib/auth.js';
import Config from '../lib/config.js';
import { ExportInput } from '../lib/api/export.js';
import TAKAPI, {
    APIAuthCertificate,
} from '../lib/tak-api.js';

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

    await schema.get('/marti/cot/:uid/all', {
        name: 'COT History',
        group: 'MartiCOTQuery',
        description: 'Helper API to list COT Queries',
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
            Type.HistoryOptions
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

            const features = await api.Query.historyFeats(req.params.uid, {
                start: req.query.start,
                end: req.query.end,
                secago: req.query.secago,
            });

            const fc = { type: 'FeatureCollection', features: [] };

            if (req.query.track) {
                let composite: Static<typeof Feature.Feature>;

                for (const feat of features) {
                    if (feat.geometry.type !== 'Point') {
                        fc.features.push(feat);
                    } if (!composite) {
                        composite = feat;
                        composite.id = `${composite.id}-track`;
                        composite.geometry = {
                            type: 'LineString',
                            coordinates: [ composite.geometry.coordinates ]
                        }
                    } else {
                        if (feat.geometry.coordinates[0] !== 0 && feat.geometry.coordinates[1]) {
                            composite.geometry.coordinates.push(feat.geometry.coordinates);
                        }
                    }
                }

                fc.features.push(composite);
            } else {
                fc.features = features;
            }

            res.json(fc);
        } catch (err) {
             Err.respond(err, res);
        }
    });
}
