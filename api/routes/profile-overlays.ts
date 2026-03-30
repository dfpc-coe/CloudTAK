import { Static, Type } from '@sinclair/typebox'
import { BasemapProtocol, TileJSONActions } from '../lib/interface-basemap.js';
import { fromProtocol } from '../lib/basemap/index.js';
import Config from '../lib/config.js';
import Schema from '@openaddresses/batch-schema';
import S3 from '../lib/aws/s3.js';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import { ProfileOverlay } from '../lib/schema.js';
import path from 'node:path';
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
                terrain: Type.Boolean(),
                snapping: Type.Boolean()
            }),
            items: Type.Array(AugmentedProfileOverlayResponse)
        })

    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const [overlays, terrain, snapping] = await Promise.all([
                config.models.ProfileOverlay.list({
                    limit: req.query.limit,
                    page: req.query.page,
                    order: req.query.order,
                    sort: req.query.sort,
                    where: sql`
                        username = ${user.email}
                    `
                }),
                config.models.Basemap.count({
                    where: sql`
                        USERNAME IS NULL
                        AND type = 'raster-dem'
                    `
                }),
                config.models.Basemap.count({
                    where: sql`
                        USERNAME IS NULL
                        AND type = 'vector'
                        AND id IN (
                            SELECT basemap
                            FROM basemaps_vector
                            WHERE snapping_enabled = true
                        )
                    `
                })
            ]);

            const available = {
                terrain: terrain > 0,
                snapping: snapping > 0
            }

            // Only fetch the profile and initialize the TAK API when mission overlays are present
            const hasMissionOverlays = overlays.items.some(item => item.mode === 'mission' && item.mode_id);
            let api: TAKAPI | null = null;
            if (hasMissionOverlays) {
                const profile = await config.models.Profile.from(user.email);
                api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(profile.auth.cert, profile.auth.key));
            }

            // Check all overlays in parallel
            const results = await Promise.all(overlays.items.map(async (item) => {
                if (item.mode === 'profile') {
                    if (!(await S3.exists(`profile/${item.username}/${path.parse(item.url.replace(/\/tile$/, '')).name}.pmtiles`))) {
                        return { keep: false as const, item };
                    }
                } else if (item.mode === 'data') {
                    if (!(await S3.exists(`data/${item.mode_id}/${path.parse(item.url.replace(/\/tile$/, '')).name}.pmtiles`))) {
                        return { keep: false as const, item };
                    }
                } else if (item.mode === 'basemap' || item.mode === 'overlay') {
                    try {
                        if (!item.mode_id) throw new Error('mode_id is required');
                        const basemap = await config.models.Basemap.from(parseInt(item.mode_id));
                        return { keep: true as const, item, actions: fromProtocol(basemap.protocol).actions() };
                    } catch (err) {
                        console.error('Could not find basemap', err);
                        return { keep: false as const, item };
                    }
                } else if (item.mode === 'mission' && item.mode_id && api) {
                    const subscription = await config.conns.subscription(user.email, item.name);
                    if (!(await api.Mission.access(item.mode_id, subscription))) {
                        return { keep: false as const, item };
                    }
                }

                return { keep: true as const, item, actions: fromProtocol().actions() };
            }));

            // Batch all deletions in parallel
            await Promise.all(
                results.filter(r => !r.keep).map(r => config.models.ProfileOverlay.delete(r.item.id))
            );

            let total = overlays.total;
            const removed: Static<typeof ProfileOverlayResponse>[] = [];
            const items: Static<typeof AugmentedProfileOverlayResponse>[] = [];

            for (const result of results) {
                if (!result.keep) {
                    removed.push({ ...result.item, opacity: Number(result.item.opacity) });
                    total--;
                } else {
                    items.push({ ...result.item, opacity: Number(result.item.opacity), actions: result.actions });
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
                if (!overlay.mode_id) throw new Err(500, null, 'Overlay missing mode_id');
                const basemap = await config.models.Basemap.from(parseInt(overlay.mode_id));

                res.json({
                    ...overlay,
                    actions: fromProtocol(basemap.protocol).actions(),
                    opacity: Number(overlay.opacity)
                });
            } else {
                res.json({
                    ...overlay,
                    actions: fromProtocol().actions(),
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
                BasemapProtocol.isValidStyle(req.body.type || overlay.type, req.body.styles);
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
                if (!overlay.mode_id) throw new Err(500, null, 'Overlay missing mode_id');
                const basemap = await config.models.Basemap.from(parseInt(overlay.mode_id));

                res.json({
                    ...overlay,
                    actions: fromProtocol(basemap.protocol).actions(),
                    opacity: Number(overlay.opacity)
                });
            } else {
                res.json({
                    ...overlay,
                    actions: fromProtocol().actions(),
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
                BasemapProtocol.isValidStyle(req.body.type || 'raster', req.body.styles);
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
                if (!overlay.mode_id) throw new Err(500, null, 'Overlay missing mode_id');
                const basemap = await config.models.Basemap.from(parseInt(overlay.mode_id));

                res.json({
                    ...overlay,
                    actions: fromProtocol(basemap.protocol).actions(),
                    opacity: Number(overlay.opacity)
                });
            } else {
                res.json({
                    ...overlay,
                    actions: fromProtocol().actions(),
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
