import spritesmith from 'spritesmith';
import Vinyl from 'vinyl';
import { promisify } from 'node:util'
import { Static } from '@sinclair/typebox';
import { IconResponse } from './types.js';

const SpriteSmith = promisify(spritesmith.run);

type SpriteConfig = {
    name?: string;
};

export default async function(icons: Array<Static<typeof IconResponse>>, config: SpriteConfig = {}) {
    const doc = await SpriteSmith({
        src: icons.map((icon) => {
            return new Vinyl({
                // @ts-expect-error Deal with indexing issue on icon
                path: config.name ? icon[config.name] + '.png' : icon.path.replace(/.*?\//, ''),
                contents: Buffer.from(icon.data, 'base64'),
            })
        })
    });

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
