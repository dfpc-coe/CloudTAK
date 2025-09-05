import { Type } from '@sinclair/typebox'
import Schema from '@openaddresses/batch-schema';
import { GenerateUpsert } from '@openaddresses/batch-generic';
import ProfileControl, { DefaultUnits } from '../lib/control/profile.js';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import {
    Profile_Stale, Profile_Speed, Profile_Elevation, Profile_Distance, Profile_Text, Profile_Projection, Profile_Zoom
} from '../lib/enums.js'
import Config from '../lib/config.js';

export default async function router(schema: Schema, config: Config) {
    const profileControl = new ProfileControl(config);

    await schema.get('/config', {
        name: 'Get Config',
        group: 'Config',
        description: 'Get Config',
        query: Type.Object({
            keys: Type.String()
        }),
        res: Type.Record(Type.String(), Type.Any())
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req, { admin: true });

            const final: Record<string, string> = {};
            (await Promise.allSettled((req.query.keys.split(',').map((key) => {
                return config.models.Setting.from(key);
            })))).forEach((k) => {
                if (k.status === 'rejected') return;
                return final[k.value.key] = String(k.value.value);
            });

            res.json(final);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.put('/config', {
        name: 'Update Config',
        group: 'Config',
        description: 'Update Config Key/Values',
        body: Type.Object({
            'agol::enabled': Type.Optional(Type.Boolean({
                description: 'Enable ArcGIS Online Integration'
            })),

            'agol::auth_method': Type.Optional(Type.String({
                description: 'AGOL Auth Type',
                enum: ['oauth2', 'legacy']
            })),

            'agol::token': Type.Optional(Type.String({
                description: 'AGOL Legacy Token'
            })),

            'agol::client_id': Type.Optional(Type.String({
                description: 'AGOL OAuth2 Client ID'
            })),

            'agol::client_secret': Type.Optional(Type.String({
                description: 'AGOL OAuth2 Client Secret'
            })),

            'media::url': Type.Optional(Type.String({
                description: 'Base URL for Media Service'
            })),

            'map::center': Type.Optional(Type.String({
                description: 'Map Center Coordinates (lng,lat)',
            })),
            'map::pitch': Type.Optional(Type.Integer({
                description: 'Default Map Pitch Angle',
                minimum: 0,
                maximum: 90
            })),
            'map::bearing': Type.Optional(Type.String({
                description: 'Default Map Bearing',
                minimum: 0,
                maximum: 360
            })),
            'map::zoom': Type.Optional(Type.Number({
                description: 'Default Map Zoom Level',
                minimum: 0,
                maximum: 20
            })),

            'display::stale': Type.Optional(Type.Enum(Profile_Stale)),
            'display::distance': Type.Optional(Type.Enum(Profile_Distance)),
            'display::elevation': Type.Optional(Type.Enum(Profile_Elevation)),
            'display::speed': Type.Optional(Type.Enum(Profile_Speed)),
            'display::projection': Type.Optional(Type.Enum(Profile_Projection)),
            'display::zoom': Type.Optional(Type.Enum(Profile_Zoom)),
            'display::text': Type.Optional(Type.Enum(Profile_Text)),
            'display::icon_rotation': Type.Optional(Type.Boolean()),

            'group::Yellow': Type.Optional(Type.String()),
            'group::Cyan': Type.Optional(Type.String()),
            'group::Green': Type.Optional(Type.String()),
            'group::Red': Type.Optional(Type.String()),
            'group::Purple': Type.Optional(Type.String()),
            'group::Orange': Type.Optional(Type.String()),
            'group::Blue': Type.Optional(Type.String()),
            'group::Magenta': Type.Optional(Type.String()),
            'group::White': Type.Optional(Type.String()),
            'group::Maroon': Type.Optional(Type.String()),
            'group::Dark Blue': Type.Optional(Type.String()),
            'group::Teal': Type.Optional(Type.String()),
            'group::Dark Green': Type.Optional(Type.String()),
            'group::Brown': Type.Optional(Type.String()),

            'oidc::enabled': Type.Optional(Type.Boolean()),
            'oidc::enforced': Type.Optional(Type.Boolean()),
            'oidc::name': Type.Optional(Type.String()),
            'oidc::discovery': Type.Optional(Type.String()),
            'oidc::client': Type.Optional(Type.String()),


            // COTAK Specific Properties
            'provider::url': Type.Optional(Type.String()),


            'login::signup': Type.Optional(Type.String({
                description: 'URL for Signup Page'
            })),
            'login::forgot': Type.Optional(Type.String({
                description: 'URL for Forgot Password Page'
            })),
            'login::logo': Type.Optional(Type.String({
                description: 'Base64 encoded PNG for logo'
            })),
        }),
        res: Type.Any()
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req, { admin: true });

            const final: Record<string, string> = {};
            (await Promise.allSettled(Object.keys(req.body).map((key) => {
                return config.models.Setting.generate({
                    key: key,
                    // @ts-expect-error Index issue - look into this later
                    value: req.body[key]
                },{
                    upsert: GenerateUpsert.UPDATE
                });
            }))).forEach((k) => {
                if (k.status === 'rejected') return;
                return final[k.value.key] = String(k.value.value);
            });

            res.json(final);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/config/display', {
        name: 'Default Display Config',
        group: 'Config',
        description: 'Return Default Display Config',
        res: DefaultUnits
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req);

            res.json(await profileControl.defaultUnits());
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/config/login', {
        name: 'Login Config',
        group: 'Config',
        description: 'Return Login Config',
        res: Type.Object({
            logo: Type.Optional(Type.String()),
            signup: Type.Optional(Type.String()),
            forgot: Type.Optional(Type.String()),
        })
    }, async (req, res) => {
        try {
            const keys = [
                'login::logo',
                'login::signup',
                'login::forgot',
            ];

            const final: Record<string, string> = {};
            (await Promise.allSettled(keys.map((key) => {
                return config.models.Setting.from(key);
            }))).forEach((k) => {
                if (k.status === 'rejected') return;
                return final[k.value.key.replace('login::', '')] = String(k.value.value);
            });

            for (let login of keys) {
                login = login.replace('login::', '')
            }

            res.json(final);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/config/tiles', {
        name: 'Tile Config',
        group: 'Config',
        description: 'Return Tile Config',
        res: Type.Object({
            url: Type.String()
        })
    }, async (req, res) => {
        try {
            res.json({
                url: config.PMTILES_URL
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/config/group', {
        name: 'List Groups',
        group: 'Config',
        description: 'Return Group Config',
        res: Type.Object({
            roles: Type.Array(Type.String()),
            groups: Type.Record(Type.String(), Type.String()),
        })
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req);

            const keys = [
                'group::Yellow',
                'group::Cyan',
                'group::Green',
                'group::Red',
                'group::Purple',
                'group::Orange',
                'group::Blue',
                'group::Magenta',
                'group::White',
                'group::Maroon',
                'group::Dark Blue',
                'group::Teal',
                'group::Dark Green',
                'group::Brown',
            ];

            const final: Record<string, string> = {};
            (await Promise.allSettled(keys.map((key) => {
                return config.models.Setting.from(key);
            }))).forEach((k) => {
                if (k.status === 'rejected') return;
                return final[k.value.key.replace('group::', '')] = String(k.value.value);
            });

            for (let group of keys) {
                group = group.replace('group::', '')
                if (!final[group]) final[group] = '';
            }

            res.json({
                roles: [ "Team Member", "Team Lead", "HQ", "Sniper", "Medic", "Forward Observer", "RTO", "K9" ],
                groups: final
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/config/map', {
        name: 'Map Config',
        group: 'Config',
        description: 'Return Map Config',
        res: Type.Object({
            center: Type.String({ default: '-100,40' }),
            zoom: Type.Number({ default: 4 }),
            pitch: Type.Integer({ default: 0 }),
            bearing: Type.Integer({ default: 0 }),
        })
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req);

            const keys = [
                'map::center',
                'map::pitch',
                'map::bearing',
                'map::zoom',
            ];

            const final: Record<string, any> = {};

            (await Promise.allSettled(keys.map((key) => {
                return config.models.Setting.from(key);
            }))).forEach((k) => {
                if (k.status === 'rejected') return;
                return final[k.value.key.replace('map::', '')] = String(k.value.value);
            });

            for (let map of keys) {
                map = map.replace('map::', '')
            }

            res.json({
                center: final.center || '-100,40',
                zoom: final.zoom || 4,
                pitch: final.pitch || 0,
                bearing: final.bearing || 0
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
