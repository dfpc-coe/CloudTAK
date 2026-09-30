import { Type } from '@sinclair/typebox';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../../common/auth.js';
import type ConfigStateless from '../config.js';
import { ionControl, IonAssets, isIonAssetName } from '../lib/control/ion.js';

async function ionToken(config: ConfigStateless): Promise<string> {
    const settings = await config.models.Setting.typedKeys(['ion::token']);
    return (settings['ion::token'] || '').trim();
}

export default async function router(schema: Schema, config: ConfigStateless) {
    await schema.get('/ion', {
        name: 'List Ion Assets',
        group: 'Ion',
        description: 'List the Cesium ion 3D Tiles assets available as overlays',
        res: Type.Object({
            items: Type.Array(Type.Object({
                name: Type.String(),
                label: Type.String(),
            })),
        }),
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req);

            if (!(await ionToken(config))) {
                res.json({ items: [] });
                return;
            }

            res.json({
                items: Object.entries(IonAssets).map(([name, asset]) => ({ name, label: asset.label })),
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/ion/geoid', {
        name: 'Get Geoid Undulation',
        group: 'Ion',
        description: 'Get the EGM96 geoid height above the WGS84 ellipsoid, used to place 3D Tiles on the terrain',
        query: Type.Object({
            lat: Type.Number({ minimum: -90, maximum: 90 }),
            lon: Type.Number({ minimum: -180, maximum: 180 }),
        }),
        res: Type.Object({
            undulation: Type.Number({ description: 'Geoid undulation in meters' }),
        }),
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req);

            // The EGM96 grid is several MB, so only load it once 3D Tiles are in use
            const { meanSeaLevel } = await import('egm96-universal');

            res.json({ undulation: meanSeaLevel(req.query.lat, req.query.lon) });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/ion/:name/endpoint', {
        name: 'Get Ion Endpoint',
        group: 'Ion',
        description: 'Get short-lived access to one allowlisted Cesium ion 3D Tiles asset',
        params: Type.Object({
            name: Type.String(),
        }),
        res: Type.Object({
            url: Type.String(),
            accessToken: Type.Optional(Type.String()),
            attributions: Type.Array(Type.Object({
                text: Type.String(),
                image: Type.Optional(Type.String()),
            })),
        }),
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req);

            if (!isIonAssetName(req.params.name)) throw new Err(404, null, 'Unknown Cesium ion asset');

            const token = await ionToken(config);
            if (!token) throw new Err(404, null, 'Cesium ion is not configured');

            res.json(await ionControl.endpoint(req.params.name, token));
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
