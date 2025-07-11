import { Type } from '@sinclair/typebox'
import Schema from '@openaddresses/batch-schema';
import { GenerateUpsert } from '@openaddresses/batch-generic';
import {
    toEnum, Profile_Stale, Profile_Speed, Profile_Elevation, Profile_Distance, Profile_Text, Profile_Projection, Profile_Zoom,
} from '../lib/enums.js'
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import Config from '../lib/config.js';

export default async function router(schema: Schema, config: Config) {
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
            'agol::enabled': Type.Optional(Type.Boolean()),
            'agol::token': Type.Optional(Type.String()),

            'media::url': Type.Optional(Type.String()),

            'map::center': Type.Optional(Type.String()),
            'map::pitch': Type.Optional(Type.Integer({
                minimum: 0,
                maximum: 90
            })),
            'map::bearing': Type.Optional(Type.String({
                minimum: 0,
                maximum: 360
            })),
            'map::zoom': Type.Optional(Type.Integer({
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
            'oidc::secret': Type.Optional(Type.String()),

            // COTAK Specific Properties
            'provider::url': Type.Optional(Type.String()),
            'provider::secret': Type.Optional(Type.String()),
            'provider::client': Type.Optional(Type.String()),

            'login::signup': Type.Optional(Type.String()),
            'login::forgot': Type.Optional(Type.String()),
            'login::logo': Type.Optional(Type.String()),
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
        res: Type.Object({
            'stale': Type.Object({
                value: Type.Enum(Profile_Stale, {
                    default: Profile_Stale.TenMinutes
                }),
                options: Type.Array(Type.Enum(Profile_Stale))
            }),
            'distance': Type.Object({
                value: Type.Enum(Profile_Distance, {
                    default: Profile_Distance.MILE
                }),
                options: Type.Array(Type.Enum(Profile_Distance))
            }),
            'elevation': Type.Object({
                value: Type.Enum(Profile_Elevation, {
                    default: Profile_Elevation.FEET
                }),
                options: Type.Array(Type.Enum(Profile_Elevation))
            }),
            'speed': Type.Object({
                value: Type.Enum(Profile_Speed, {
                    default: Profile_Speed.MPH
                }),
                options: Type.Array(Type.Enum(Profile_Speed))
            }),
            'projection': Type.Object({
                value: Type.Enum(Profile_Projection, {
                    default: Profile_Projection.GLOBE
                }),
                options: Type.Array(Type.Enum(Profile_Projection))
            }),
            'zoom': Type.Object({
                value: Type.Enum(Profile_Zoom, {
                    default: Profile_Zoom.CONDITIONAL
                }),
                options: Type.Array(Type.Enum(Profile_Zoom))
            }),
            'text': Type.Object({
                value: Type.Enum(Profile_Text, {
                    default: Profile_Text.Medium
                }),
                options: Type.Array(Type.Enum(Profile_Text))
            }),
        })
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req);

            const keys = [
                'display::stale',
                'display::distance',
                'display::elevation',
                'display::speed',
                'display::projection',
                'display::zoom',
                'display::text',
            ];

            const final: Record<string, string> = {};
            (await Promise.allSettled(keys.map((key) => {
                return config.models.Setting.from(key);
            }))).forEach((k) => {
                if (k.status === 'rejected') return;
                return final[k.value.key.replace('display::', '')] = String(k.value.value);
            });

            for (let display of keys) {
                display = display.replace('display::', '')
            }

            res.json({
                stale: {
                    value: toEnum.fromString(Type.Enum(Profile_Stale), final.stale),
                    options: Object.values(Profile_Stale)
                },
                distance: {
                    value: toEnum.fromString(Type.Enum(Profile_Distance), final.distance),
                    options: Object.values(Profile_Distance)
                },
                elevation: {
                    value: toEnum.fromString(Type.Enum(Profile_Elevation), final.elevation),
                    options: Object.values(Profile_Elevation)
                },
                speed: {
                    value: toEnum.fromString(Type.Enum(Profile_Speed), final.speed),
                    options: Object.values(Profile_Speed)
                },
                projection: {
                    value: toEnum.fromString(Type.Enum(Profile_Projection), final.projection),
                    options: Object.values(Profile_Projection)
                },
                zoom: {
                    value: toEnum.fromString(Type.Enum(Profile_Zoom), final.zoom),
                    options: Object.values(Profile_Zoom)
                },
                text: {
                    value: toEnum.fromString(Type.Enum(Profile_Text), final.text),
                    options: Object.values(Profile_Text)
                }
            });
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
            zoom: Type.Integer({ default: 4 }),
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
