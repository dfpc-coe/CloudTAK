import { Type } from '@sinclair/typebox'
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import Config from '../lib/config.js';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';

export const AgencyResponse = Type.Object({
    id: Type.Integer(),
    name: Type.String(),
});

export default async function router(schema: Schema, config: Config) {
    await schema.get('/fonts/:fontstack/:start-:end.pbf', {
        name: 'Get Fonts',
        group: 'Fonts',
        params: Type.Object({
            fontstack: Type.String({
                description: 'Font Stack',
            }),
            start: Type.Integer({
                description: 'Starting Glyph',
            }),
            end: Type.Integer({
                description: 'Ending Glyph',
            }),
        }),
        description: 'Return MapLibre Font Glyphs',
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req, {
                token: true
            });

            try {
                await fsp.access(new URL(`../fonts/${req.params.fontstack}/${req.params.start}-${req.params.end}.pbf`, import.meta.url))
            } catch (err) {
                if (err instanceof Error && 'code' in err && err.code === 'ENOENT') {
                    req.params.fontstack = 'Open Sans Regular';
                } else {
                    throw new Err(500, err instanceof Error ? err : new Error(String(err)), 'Internal Server Error');
                }
            }

            try {
                await fsp.access(new URL(`../fonts/${req.params.fontstack}/${req.params.start}-${req.params.end}.pbf`, import.meta.url))
            } catch (err) {
                if (err instanceof Error && 'code' in err && err.code === 'ENOENT') {
                    throw new Err(404, err, 'Font stack or glyph range not found');
                } else {
                    throw new Err(500, err instanceof Error ? err : new Error(String(err)), 'Internal Server Error');
                }
            }

            fs.createReadStream(new URL(`../fonts/${req.params.fontstack}/${req.params.start}-${req.params.end}.pbf`, import.meta.url))
                .pipe(res);
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
