import spritesmith from 'spritesmith';
import Vinyl from 'vinyl';
import { promisify } from 'node:util'
import { Icon } from './schema.js';
import { type InferSelectModel } from 'drizzle-orm';

const SpriteSmith = promisify(spritesmith.run);

type SpriteConfig = {
    name?: string;
};

export default async function(icons: Array<InferSelectModel<typeof Icon>>, config: SpriteConfig = {}) {
    const doc = await SpriteSmith({
        src: icons.map((icon) => {
            return new Vinyl({
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
