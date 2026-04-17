import { Type, Static } from '@sinclair/typebox'
import Schema from '@openaddresses/batch-schema';
import { GenerateUpsert } from '@openaddresses/batch-generic';
import ProfileControl, { DefaultUnits } from '../lib/control/profile.js';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import Config from '../lib/config.js';
import { FullConfig } from '../lib/types.js';
import { FullConfigDefaults } from '../lib/defaults.js';

export { FullConfigDefaults };

// Allows Unauthenticated Access to these Config Keys
export const PublicConfigKeys: (keyof Static<typeof FullConfig>)[] = [
    'media::url',
    'login::signup',
    'login::forgot',
    'login::name',
    'login::username',
    'login::brand::enabled',
    'login::brand::logo',
    'login::background::enabled',
    'login::background::color',
    'login::logo',
    'oidc::enabled',
    'oidc::enforced',
    'oidc::name',
    'oidc::discovery',
    'oidc::logo',
    'passkey::enabled',
];

// Allow Authenticated but Non-Admin Access to these Config Keys
export const UserConfigKeys: (keyof Static<typeof FullConfig>)[] = [
    'map::center',
    'map::pitch',
    'map::bearing',
    'map::zoom',
    'map::basemap',
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
    'external::applications',]

const GeofenceConfigKeys = new Set<keyof Static<typeof FullConfig>>([
    'geofence::enabled',
    'geofence::url',
    'geofence::password'
]);

function serializeConfigValue<K extends keyof Static<typeof FullConfig>>(
    key: K,
    value: Static<typeof FullConfig>[K]
): string {
    const schema = FullConfig.properties[key] as any;

    if (schema.type === 'array' || schema.type === 'object') {
        return JSON.stringify(value);
    }

    if (Array.isArray(schema.anyOf) && schema.anyOf.some((entry: any) => entry.type === 'array' || entry.type === 'object')) {
        return JSON.stringify(value);
    }

    return String(value);
}

export default async function router(schema: Schema, config: Config) {
    const profileControl = new ProfileControl(config);

    await schema.get('/config', {
        name: 'Get Config',
        group: 'Config',
        description: 'Get Config',
        query: Type.Object({
            keys: Type.String()
        }),
        res: Type.Partial(FullConfig)
    }, async (req, res) => {
        try {
            const keys = (req.query.keys || '').split(',') as (keyof Static<typeof FullConfig>)[];
            if (!keys.every((k) => (PublicConfigKeys as readonly string[]).includes(k))) {
                if (keys.every((k) => (PublicConfigKeys as readonly string[]).includes(k) || (UserConfigKeys as readonly string[]).includes(k))) {
                    await Auth.as_user(config, req);
                } else {
                    await Auth.as_user(config, req, { admin: true });
                }
            }

            res.json(await config.models.Setting.typedKeys(keys));
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.put('/config', {
        name: 'Update Config',
        group: 'Config',
        description: 'Update Config Key/Values',
        body: Type.Partial(FullConfig),
        res: Type.Partial(FullConfig)
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req, { admin: true });

            const updatedKeys = Object.keys(req.body) as (keyof Static<typeof FullConfig>)[];
            const refreshGeofence = updatedKeys.some((key) => GeofenceConfigKeys.has(key));

            const final: Partial<Static<typeof FullConfig>> = {};
            (await Promise.allSettled(updatedKeys.map(async (key) => {
                if (req.body[key] === null) {
                    await config.models.Setting.delete(key);
                    return { key, value: null };
                }

                await config.models.Setting.generate({
                    key: key,
                    value: serializeConfigValue(key, req.body[key] as Static<typeof FullConfig>[typeof key])
                },{
                    upsert: GenerateUpsert.UPDATE
                });

                return {
                    key,
                    value: req.body[key]
                };
            }))).forEach((k) => {
                if (k.status === 'rejected') return;
                return final[k.value.key as keyof Static<typeof FullConfig>] = k.value.value as any;
            });

            if (refreshGeofence) {
                await config.geofence.refresh();
            }

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
            name: Type.Optional(Type.String()),
            logo: Type.Optional(Type.String()),
            signup: Type.Optional(Type.String()),
            forgot: Type.Optional(Type.String()),
            username: Type.String({
                default: 'Username or Email'
            }),
            brand: Type.Object({
                enabled: Type.String({
                    description: 'Enable Custom Branding on Login Page',
                    enum: ['default', 'enabled', 'disabled']
                }),
                logo: Type.Optional(Type.String({
                    description: 'Brand Logo Data'
                }))
            }),
            background: Type.Object({
                enabled: Type.Boolean({
                    description: 'Enable or Disable Custom Background on Login Page'
                }),
                color: Type.Optional(Type.String())
            })
        })
    }, async (req, res) => {
        try {
            const keys = [
                'login::name',
                'login::logo',
                'login::signup',
                'login::forgot',
                'login::username',
                'login::brand::enabled',
                'login::brand::logo',
                'login::background::enabled',
                'login::background::color',
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

            res.json({
                name: final.name || 'CloudTAK',
                logo: final.logo,
                signup: final.signup,
                forgot: final.forgot,
                username: final.username || 'Username or Email',
                brand: {
                    enabled: final['brand::enabled'] || 'default',
                    logo: final['brand::logo']
                },
                background: {
                    enabled: final['background::enabled'] === 'true' ? true : false,
                    color: final['background::color'] || undefined
                }
            });
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
        deprecated: true,
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
            basemap: Type.Union([Type.Null(), Type.Integer()])
        })
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req);

            const keys = [
                'map::center',
                'map::pitch',
                'map::bearing',
                'map::zoom',
                'map::basemap'
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
                bearing: final.bearing || 0,
                basemap: final.basemap ? Number(final.basemap) : null
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
