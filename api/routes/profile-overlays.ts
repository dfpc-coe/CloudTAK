import Err from '@openaddresses/batch-error';
import Profile from '../lib/types/profile.ts';
import Auth from '../lib/auth.ts';
import { Response } from 'express';
import { AuthRequest } from '@tak-ps/blueprint-login';
import Config from '../lib/config.ts';
import { type InferSelectModel } from 'drizzle-orm';
import { ProfileOverlay } from '../lib/schema.ts';
import Modeler from '../lib/drizzle.ts';

export default async function router(schema: any, config: Config) {
    const OverlayModel = new Modeler<InferSelectModel<typeof ProfileOverlay>>(config.pg, ProfileOverlay);

    await schema.get('/profile/overlay', {
        name: 'Get Overlays',
        auth: 'user',
        group: 'ProfileOverlays',
        description: 'Get User\'s Profile Overlays',
        res: 'res.ListProfileOverlays.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            const overlays = await OverlayModel.list({
                limit: Number(req.query.limit)
            });

            return res.json(overlays);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.post('/profile/overlay', {
        name: 'Create Overlay',
        auth: 'user',
        group: 'ProfileOverlay',
        description: 'Create Profile Overlay',
        body: 'req.body.CreateProfileOverlay.json',
        res: 'profile_overlays.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            const overlay = await OverlayModel.generate({
                username: req.auth.email,
                ...req.body
            });

            return res.json(overlay);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

}
