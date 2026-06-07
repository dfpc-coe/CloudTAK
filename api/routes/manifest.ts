import { Type } from '@sinclair/typebox';
import Config from '../lib/config.js';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import { buildLogos } from '../lib/logos.js';

export default async function router(schema: Schema, config: Config) {
    let logos: Map<number, Buffer> = await buildLogos(config);

    await schema.get('/manifest.webmanifest', {
        name: 'Get Web Manifest',
        group: 'Manifest',
        description: 'Return the Web Manifest for PWA Use',
        res: Type.Object({
            name: Type.String(),
            short_name: Type.String(),
            description: Type.String(),
            start_url: Type.String(),
            display: Type.String(),
            background_color: Type.String(),
            theme_color: Type.String(),
            lang: Type.String(),
            scope: Type.String(),
            icons: Type.Array(Type.Object({
                src: Type.String(),
                sizes: Type.String(),
                type: Type.String(),
            })),
            orientation: Type.String(),
            categories: Type.Array(Type.String()),
        }),

    }, async (req, res) => {
        try {
            logos = await buildLogos(config);

            res.json({
                name: config.server.name,
                short_name: config.server.name,
                description: 'Cloud powered in-browser TAK Client',
                start_url: '/',
                display: 'standalone',
                background_color: '#ffffff',
                theme_color: '#000000',
                lang: 'en',
                scope: '/',
                icons: Array.from(logos.keys()).map(size => ({
                    src: `/api/manifest.webmanifest/logos/${size}`,
                    sizes: `${size}x${size}`,
                    type: 'image/png',
                })),
                orientation: 'any',
                categories: ['utilities', 'productivity', 'navigation', 'government'],
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/manifest.webmanifest/logos/:size', {
        name: 'Get Manifest Logo',
        group: 'Manifest',
        description: 'Return a resized PNG logo for PWA use',
        params: Type.Object({
            size: Type.Integer({ description: 'Logo size in pixels' }),
        }),
    }, async (req, res) => {
        try {
            const size = req.params.size;
            const logo = logos.get(size);

            if (!logo) throw new Err(404, null, 'Logo not found');

            res.set('Content-Type', 'image/png');
            res.send(logo);
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
