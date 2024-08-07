import { Type } from '@sinclair/typebox'
import { validate } from '@maplibre/maplibre-gl-style-spec';
import path from 'node:path';
import Config from '../lib/config.js';
import Schema from '@openaddresses/batch-schema';
import S3 from '../lib/aws/s3.js';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import { ProfileOverlay } from '../lib/schema.js';
import { StandardResponse, ProfileOverlayResponse } from '../lib/types.js'
import { sql } from 'drizzle-orm';
import TAKAPI, {
    APIAuthCertificate,
} from '../lib/tak-api.js';
import * as Default from '../lib/limits.js';

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
            sort: Type.Optional(Type.String({ default: 'pos', enum: Object.keys(ProfileOverlay) })),
        }),
        res: Type.Object({
            total: Type.Integer(),
            removed: Type.Array(ProfileOverlayResponse),
            items: Type.Array(ProfileOverlayResponse)
        })

    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            const auth = (await config.models.Profile.from(user.email)).auth;
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

            const overlays = await config.models.ProfileOverlay.list({
                limit: req.query.limit,
                page: req.query.page,
                order: req.query.order,
                sort: req.query.sort,
                where: sql`
                    username = ${user.email}
                `
            });

            const removed = [];

            for (let i = 0; i < overlays.items.length; i++) {
                const item = overlays.items[i];

                if (
                    (item.mode === 'profile' && !(await S3.exists(`profile/${item.username}/${path.parse(item.url.replace(/\/tile$/, '')).name}.pmtiles`)))
                    || (item.mode === 'data' && !(await S3.exists(`data/${item.mode_id}/${path.parse(item.url.replace(/\/tile$/, '')).name}.pmtiles`)))
                ) {
                    await config.models.ProfileOverlay.delete(item.id);
                    removed.push(...overlays.items.splice(i, 1));
                    overlays.total--;
                } else if (item.mode === 'basemap') {
                    try {
                        await config.models.Basemap.from(item.mode_id);
                    } catch (err) {
                        console.error('Could not find basemap', err);
                        await config.models.ProfileOverlay.delete(item.id);
                        removed.push(...overlays.items.splice(i, 1));
                        overlays.total--;
                    }
                } else if (item.mode === 'mission' && !(await api.Mission.access(
                        item.mode_id,
                        await config.conns.subscription(user.email, item.name)
                    ))
                ) {
                    await config.models.ProfileOverlay.delete(item.id);
                    removed.push(...overlays.items.splice(i, 1));
                    overlays.total--;
                }
            }

            return res.json({
                removed,
                ...overlays
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/profile/overlay/:overlay', {
        name: 'Get Overlay',
        group: 'ProfileOverlay',
        description: 'Get Profile Overlay',
        params: Type.Object({
            overlay: Type.Integer()
        }),
        res: ProfileOverlayResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const overlay = await config.models.ProfileOverlay.from(req.params.overlay)
            if (overlay.username !== user.email) throw new Err(401, null, 'Cannot get another\'s overlay');

            return res.json(overlay);
        } catch (err) {
            return Err.respond(err, res);
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
            opacity: Type.Optional(Type.Number()),
            visible: Type.Optional(Type.Boolean()),
            url: Type.Optional(Type.String()),
            mode_id: Type.Optional(Type.String()),
            styles: Type.Optional(Type.Any())
        }),
        res: ProfileOverlayResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            let overlay = await config.models.ProfileOverlay.from(req.params.overlay)
            if (overlay.username !== user.email) throw new Err(401, null, 'Cannot edit another\'s overlay');

            if (req.body.styles) {
                const errors = validate(req.body.styles)
                if (errors.length) throw new Err(400, null, JSON.stringify(errors));
            }

            overlay = await config.models.ProfileOverlay.commit(req.params.overlay, req.body)

            return res.json(overlay);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.post('/profile/overlay', {
        name: 'Create Overlay',
        group: 'ProfileOverlay',
        description: 'Create Profile Overlay',
        body: Type.Object({
            pos: Type.Optional(Type.Integer()),
            type: Type.Optional(Type.String()),
            opacity: Type.Optional(Type.Number()),
            visible: Type.Optional(Type.Boolean()),
            mode: Type.String(),
            mode_id: Type.Optional(Type.String()),
            url: Type.String(),
            name: Type.String()
        }),
        res: ProfileOverlayResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const overlay = await config.models.ProfileOverlay.generate({
                ...req.body,
                opacity: String(req.body.opacity || 1),
                username: user.email
            });

            if (req.body.mode === 'mission') {
                const profile = await config.models.Profile.from(user.email);
                const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(profile.auth.cert, profile.auth.key));

                const mission = await api.Mission.getGuid(overlay.mode_id, {});
                const sub = await api.Mission.subscribe(mission.name, {
                    uid: `ANDROID-CloudTAK-${user.email}`
                });

                await config.models.ProfileOverlay.commit(overlay.id, {
                    token: sub.data.token
                })
            }

            return res.json(overlay);
        } catch (err) {
            return Err.respond(err, res);
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

            if (overlay.mode === 'mission') {
                const profile = await config.models.Profile.from(user.email);
                const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(profile.auth.cert, profile.auth.key));
                const mission = await api.Mission.getGuid(overlay.mode_id, {});
                await api.Mission.unsubscribe(mission.name, {
                    uid: `ANDROID-CloudTAK-${user.email}`
                },{
                    token: overlay.token
                });
            }

            return res.json({
                status: 200,
                message: 'Overlay Removed'
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
