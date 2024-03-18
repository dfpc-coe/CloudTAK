import { Type } from '@sinclair/typebox'
import { validate } from '@maplibre/maplibre-gl-style-spec';
import path from 'node:path';
import Config from '../lib/config.js';
import Schema from '@openaddresses/batch-schema';
import S3 from '../lib/aws/s3.js';
import Err from '@openaddresses/batch-error';
import Auth, { AuthResource } from '../lib/auth.js';
import { StandardResponse, ProfileOverlayResponse } from '../lib/types.js'
import { Response } from 'express';
import { sql } from 'drizzle-orm';
import TAKAPI, {
    APIAuthToken,
    APIAuthCertificate,
    APIAuthPassword
} from '../lib/tak-api.js';

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
            limit: Type.Optional(Type.Integer())
        }),
        res: Type.Object({
            total: Type.Integer(),
            removed: Type.Array(ProfileOverlayResponse),
            items: Type.Array(ProfileOverlayResponse)
        })

    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const overlays = await config.models.ProfileOverlay.list({
                limit: req.query.limit,
                where: sql`
                    username = ${user.email}
                `
            });

            const removed = [];

            for (let i = 0; i < overlays.items.length; i++) {
                const item = overlays.items[i];

                // TODO someday surface these to the user that the underlying resources don't exist
                if (
                    (item.mode === 'profile' && !(await S3.exists(`profile/${item.username}/${path.parse(item.url.replace(/\/tile$/, '')).name}.pmtiles`)))
                    || (item.mode === 'data' && !(await S3.exists(`data/${item.mode_id}/${path.parse(item.url.replace(/\/tile$/, '')).name}.pmtiles`)))
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
            styles: Type.Optional(Type.Any())
        }),
        res: ProfileOverlayResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const overlay = await config.models.ProfileOverlay.from(req.params.overlay)
            if (overlay.username !== user.email) throw new Err(401, null, 'Cannot edit another\'s overlay');

            if (req.body.styles) {
                const errors = validate(req.body.styles)
                if (errors.length) throw new Err(400, null, JSON.stringify(errors));
            }

            await config.models.ProfileOverlay.commit(req.params.overlay, req.body)

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
            mode_id: Type.String(),
            url: Type.String(),
            name: Type.String()
        }),
        res: ProfileOverlayResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const overlay = await config.models.ProfileOverlay.generate({
                ...req.body,
                username: user.email
            });

            if (req.body.mode === 'mission') {
                const profile = await config.models.Profile.from(user.email);
                const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(profile.auth.cert, profile.auth.key));

                const mission = await api.Mission.getGuid(overlay.mode_id, {});
                await api.Mission.subscribe(mission.name, { uid: user.email });
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
                await api.Mission.unsubscribe(mission.name, { uid: user.email });
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
