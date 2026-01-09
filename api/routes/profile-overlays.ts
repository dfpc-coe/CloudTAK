import { Static, Type } from '@sinclair/typebox'
import TileJSON from '../lib/control/tilejson.js';
import path from 'node:path';
import Config from '../lib/config.js';
import Schema from '@openaddresses/batch-schema';
import S3 from '../lib/aws/s3.js';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import { ProfileOverlay } from '../lib/schema.js';
import { TileJSONActions } from '../lib/control/tilejson.js';
import { StandardResponse, ProfileOverlayResponse } from '../lib/types.js'
import { sql } from 'drizzle-orm';
import { TAKAPI, APIAuthCertificate, } from '@tak-ps/node-tak';
import * as Default from '../lib/limits.js';

const AugmentedProfileOverlayResponse = Type.Composite([
    ProfileOverlayResponse,
    Type.Object({
        actions: TileJSONActions
    })
])

export default async function router(schema: Schema, config: Config) {
    await schema.get('/profile/overlay', {
        name: 'Get Overlays',
        group: 'ProfileOverlays',
        description: `
            Return a list of Profile Overlay's that are curently active.

            Each item is checked to ensure it is still present and if not the overlay is removed from the list
            before being returned.
        `,
        query: Type.Object({
            limit: Default.Limit,
            page: Default.Page,
            order: Default.Order,
            sort: Type.String({
                default: 'pos',
                enum: Object.keys(ProfileOverlay)
            }),
        }),
        res: Type.Object({
            total: Type.Integer(),
            removed: Type.Array(ProfileOverlayResponse),
            available: Type.Object({
                terrain: Type.Boolean()
            }),
            items: Type.Array(AugmentedProfileOverlayResponse)
        })

    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            const auth = (await config.models.Profile.from(user.email)).auth;
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

            const available = {
                terrain:
                    (
                        await config.models.Basemap.count({
                            where: sql`
                                USERNAME IS NULL
                                AND type = 'raster-dem'
                            `
                        })
                    ) > 0
            }

            const overlays = await config.models.ProfileOverlay.list({
                limit: req.query.limit,
                page: req.query.page,
                order: req.query.order,
                sort: req.query.sort,
                where: sql`
                    username = ${user.email}
                `
            });

            let total = overlays.total;
            const removed: Static<typeof ProfileOverlayResponse>[] = [];
            const items: Static<typeof AugmentedProfileOverlayResponse>[] = [];

            for (let i = 0; i < overlays.items.length; i++) {
                const item = overlays.items[i];

                if (
                    (item.mode === 'profile' && !(await S3.exists(`profile/${item.username}/${path.parse(item.url.replace(/\/tile$/, '')).name}.pmtiles`)))
                    || (item.mode === 'data' && !(await S3.exists(`data/${item.mode_id}/${path.parse(item.url.replace(/\/tile$/, '')).name}.pmtiles`)))
                ) {
                    await config.models.ProfileOverlay.delete(item.id);
                    removed.push(...overlays.items.splice(i, 1).map((o) => {
                        return { ...item, opacity: Number(o.opacity) }
                    }));
                    total--;
                } else if (item.mode === 'basemap' || item.mode === 'overlay') {
                    try {
                        const basemap = await config.models.Basemap.from(item.mode_id);
                        items.push({
                            ...item,
                            opacity: Number(item.opacity),
                            actions: TileJSON.actions(basemap.url)
                        });
                    } catch (err) {
                        console.error('Could not find basemap', err);
                        await config.models.ProfileOverlay.delete(item.id);
                        removed.push(...overlays.items.splice(i, 1).map((o) => {
                            return { ...item, opacity: Number(o.opacity) }
                        }));
                        total--;
                    }
                } else if (item.mode === 'mission' && item.mode_id && !(await api.Mission.access(
                        item.mode_id,
                        await config.conns.subscription(user.email, item.name)
                    ))
                ) {
                    await config.models.ProfileOverlay.delete(item.id);
                    removed.push(...overlays.items.splice(i, 1).map((o) => {
                        return { ...item, opacity: Number(o.opacity) }
                    }));
                    total--;
                } else {
                    items.push({ ...item, opacity: Number(item.opacity), actions: TileJSON.actions() });
                }
            }

            res.json({ removed, total, items, available });
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.get('/profile/overlay/:overlay', {
        name: 'Get Overlay',
        group: 'ProfileOverlay',
        description: 'Get Profile Overlay',
        params: Type.Object({
            overlay: Type.Integer()
        }),
        res: AugmentedProfileOverlayResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const overlay = await config.models.ProfileOverlay.from(req.params.overlay)
            if (overlay.username !== user.email) throw new Err(401, null, 'Cannot get another\'s overlay');

            if (overlay.mode === 'basemap' || overlay.mode === 'overlay') {
                const basemap = await config.models.Basemap.from(overlay.mode_id);

                res.json({
                    ...overlay,
                    actions: TileJSON.actions(basemap.url),
                    opacity: Number(overlay.opacity)
                });
            } else {
                res.json({
                    ...overlay,
                    actions: TileJSON.actions(),
                    opacity: Number(overlay.opacity)
                });
            }
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.patch('/profile/overlay/:overlay', {
        name: 'Update Overlay',
        group: 'ProfileOverlay',
        description: 'Update Profile Overlay',
        params: Type.Object({
            overlay: Type.Integer()
        }),
        body: Type.Object({
            pos: Type.Optional(Type.Integer()),
            name: Type.Optional(Type.String()),
            active: Type.Optional(Type.Boolean()),
            frequency: Type.Optional(Type.Union([Type.Null(), Type.Number()])),
            iconset: Type.Optional(Type.Union([Type.Null(), Type.String()])),
            type: Type.Optional(Type.String()),
            opacity: Type.Optional(Type.Number()),
            visible: Type.Optional(Type.Boolean()),
            url: Type.Optional(Type.String()),
            mode_id: Type.Optional(Type.String()),
            styles: Type.Optional(Type.Array(Type.Unknown())),
        }),
        res: AugmentedProfileOverlayResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            let overlay = await config.models.ProfileOverlay.from(req.params.overlay)
            if (overlay.username !== user.email) throw new Err(401, null, 'Cannot edit another\'s overlay');

            if (req.body.styles && req.body.styles.length) {
                TileJSON.isValidStyle(req.body.type || overlay.type, req.body.styles);
            }

            if (overlay.mode === 'profile' && req.body.url && req.body.url.startsWith('http')) {
                const url = new URL(req.body.url);
                req.body.url = url.pathname;
            }

            if (req.body.active && overlay.mode !== 'mission') {
                throw new Err(400, null, 'Only mission overlays can be made active');
            } else if (req.body.active) {
                await config.models.ProfileOverlay.commit(sql`
                    username = ${user.email}
                `, {
                    active: false
                });
            }

            overlay = await config.models.ProfileOverlay.commit(req.params.overlay, req.body)

            if (overlay.mode === 'basemap' || overlay.mode === 'overlay') {
                const basemap = await config.models.Basemap.from(overlay.mode_id);

                res.json({
                    ...overlay,
                    actions: TileJSON.actions(basemap.url),
                    opacity: Number(overlay.opacity)
                });
            } else {
                res.json({
                    ...overlay,
                    actions: TileJSON.actions(),
                    opacity: Number(overlay.opacity)
                });
            }
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.post('/profile/overlay', {
        name: 'Create Overlay',
        group: 'ProfileOverlay',
        description: 'Create Profile Overlay',
        body: Type.Object({
            name: Type.String(),
            active: Type.Optional(Type.Boolean()),
            pos: Type.Optional(Type.Integer()),
            type: Type.Optional(Type.String()),
            opacity: Type.Optional(Type.Number()),
            frequency: Type.Optional(Type.Union([Type.Null(), Type.Number()])),
            iconset: Type.Optional(Type.Union([Type.Null(), Type.String()])),
            visible: Type.Optional(Type.Boolean()),
            mode: Type.String(),
            mode_id: Type.Optional(Type.String()),
            styles: Type.Optional(Type.Array(Type.Unknown())),
            token: Type.Optional(Type.String()),
            url: Type.String(),
        }),
        res: AugmentedProfileOverlayResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            if (req.body.styles && req.body.styles.length) {
                TileJSON.isValidStyle(req.body.type || 'raster', req.body.styles);
            }

            if (req.body.active && req.body.mode !== 'mission') {
                throw new Err(400, null, 'Only mission overlays can be made active');
            } else if (req.body.active) {
                await config.models.ProfileOverlay.commit(sql`
                    username = ${user.email}
                `, {
                    active: false
                });
            }

            let overlay;
            if (req.body.mode === 'mission') {
                if (!req.body.mode_id) throw new Err(400, null, 'Mode: Mission must have mode_id set');

                const profile = await config.models.Profile.from(user.email);
                const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(profile.auth.cert, profile.auth.key));

                const sub = await api.Mission.subscribe(req.body.mode_id, {
                    uid: `ANDROID-CloudTAK-${user.email}`
                }, {
                    token: req.body.token
                });

                overlay = await config.models.ProfileOverlay.generate({
                    ...req.body,
                    opacity: String(req.body.opacity || 1),
                    username: user.email,
                    token: sub.data.token
                })
            } else {
                if (req.body.mode === 'profile' && req.body.url.startsWith('http')) {
                    const url = new URL(req.body.url);
                    req.body.url = url.pathname;
                }

                overlay = await config.models.ProfileOverlay.generate({
                    ...req.body,
                    opacity: String(req.body.opacity || 1),
                    username: user.email
                });
            }

            if (overlay.mode === 'basemap' || overlay.mode === 'overlay') {
                const basemap = await config.models.Basemap.from(overlay.mode_id);

                res.json({
                    ...overlay,
                    actions: TileJSON.actions(basemap.url),
                    opacity: Number(overlay.opacity)
                });
            } else {
                res.json({
                    ...overlay,
                    actions: TileJSON.actions(),
                    opacity: Number(overlay.opacity)
                });
            }
        } catch (err) {
            if (String(err).includes('duplicate key value violates unique constraint')) {
                 Err.respond(new Err(400, err instanceof Error ? err : new Error(String(err)), 'Overlay appears to exist - cannot add duplicate'), res)
            } else {
                 Err.respond(err, res);
            }
        }
    });

    await schema.delete('/profile/overlay', {
        name: 'delete Overlay',
        group: 'ProfileOverlay',
        description: 'Create Profile Overlay',
        query: Type.Object({
            id: Type.String()
        }),
        res: StandardResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const overlay = await config.models.ProfileOverlay.from(parseInt(String(req.query.id)));

            if (overlay.username !== user.email) {
                throw new Err(403, null, 'Cannot delete anothers overlays');
            }

            await config.models.ProfileOverlay.delete(overlay.id);

            if (overlay.mode === 'mission' && overlay.mode_id) {
                const profile = await config.models.Profile.from(user.email);
                const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(profile.auth.cert, profile.auth.key));

                try {
                    await api.Mission.unsubscribe(overlay.mode_id, {
                        uid: `ANDROID-CloudTAK-${user.email}`
                    },{
                        token: overlay.token || undefined
                    });
                } catch (err) {
                    // Currently ignored as this usually just means the Mission has been deleted
                    // TODO Ask ARA to return a 4xx error code
                    console.error(err);
                }
            }

            res.json({
                status: 200,
                message: 'Overlay Removed'
            });
        } catch (err) {
             Err.respond(err, res);
        }
    });
}
