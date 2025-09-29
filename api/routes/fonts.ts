import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import Config from '../lib/config.js';
import Schema from '@openaddresses/batch-schema';
import { Type } from '@sinclair/typebox'

export default async function router(schema: Schema, config: Config) {
    const fonts: Set<string> = new Set();

    for (const file of await fsp.readdir(new URL('../fonts/', import.meta.url))) {
        if (file === 'LICENSE') continue;
        fonts.add(path.parse(file).name);
    }

    await schema.get('/fonts/:fontstack/:range.pbf', {
        name: 'Font Gylphs',
        group: 'Fonts',
        description: 'MapLibre Font Endpoint',
        params: Type.Object({
            fontstack: Type.String(),
            range: Type.String()
        }),
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req);

            if (!fonts.has(req.params.fontstack)) {
                req.params.fontstack = 'Noto Sans Regular'
            }

            const file = fs.createReadStream(new URL(`../fonts/${req.params.fontstack}/${req.params.range}.pbf`, import.meta.url))

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/x-protobuf');

            file.pipe(res);
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
