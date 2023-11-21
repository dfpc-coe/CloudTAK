import spritesmith from 'spritesmith';
import Vinyl from 'vinyl';
import { promisify } from 'node:util'

const SpriteSmith = promisify(spritesmith.run);

export default async function(icons) {
    const doc = await SpriteSmith({
        src: icons.icons.map((icon) => {
            return new Vinyl({
                path: icon.path.replace(/.*?\//, ''),
                contents: Buffer.from(icon.data, 'base64'),
            })
        })
    });

    const coords = {};
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
