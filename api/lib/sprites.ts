import spritesmith from 'spritesmith';
import Vinyl from 'vinyl';
import { promisify } from 'node:util'
import { Static } from '@sinclair/typebox';
import { IconResponse } from './types.js';
import Sharp from 'sharp';

const SpriteSmith = promisify(spritesmith.run);

type SpriteConfig = {
    name?: string;
    useDataAlt?: boolean;
};

export default async function(icons: Array<Static<typeof IconResponse>>, config: SpriteConfig = {}) {
    const src = [];
    for (const icon of icons) {
        const contents = await Sharp(Buffer.from(config.useDataAlt && icon.data_alt ? icon.data_alt : icon.data, 'base64'))
            .resize(32, 32, {
                fit: 'contain',
                background: {r: 0, g: 0, b: 0, alpha: 0}
            })
            .png()
            .toBuffer();

        src.push(new Vinyl({
            // @ts-expect-error Deal with indexing issue on icon
            path: config.name ? icon[config.name] + '.png' : icon.path.replace(/.*?\//, ''),
            contents
        }))
    }

    const doc = await SpriteSmith({ src });

    const coords: Record<string, any> = {};
    for (const key in doc.coordinates) {
        coords[key.replace(/.png/, '')] = {
            ...doc.coordinates[key],
            pixelRatio: 1
        }
    }

    return {
        json: coords,
        image: doc.image
    }
}
