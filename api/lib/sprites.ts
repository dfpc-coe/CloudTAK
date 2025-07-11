import spritesmith from 'spritesmith';
import Vinyl from 'vinyl';
import { promisify } from 'node:util'
import { Static } from '@sinclair/typebox';
import Config from './config.js';
import { IconResponse } from './types.js';
import { sql } from 'drizzle-orm';
import Sharp from 'sharp';

const SpriteSmith = promisify(spritesmith.run);

type SpriteConfig = {
    name?: string;
    useDataAlt?: boolean;
};

export default class SpriteBuilder {
    /**
     * Given an Iconset UID, generate and save a spritesheet to the database
     * Note: Permissions checks are not performed here, this is expected to be handled upstream
     *
     * @param config - The configuration object containing models and other settings
     * @param iconset - The UID of the iconset to generate the spritesheet for
     * @param config - Additional configuration options for the sprite generation
     */
    static async regen(config: Config, iconset: string, spriteConfig: SpriteConfig = {}) {
        // TODO: Dont' use hardcoded limit here
        const icons = await config.models.Icon.list({
            limit: 1000,
            where: sql`
                (${iconset}::TEXT IS NULL OR ${iconset}::TEXT = iconset)
            `
        })

        const sprites = await this.from_icons(icons.items, spriteConfig);

        await config.models.Iconset.commit(iconset, {
            spritesheet_data: sprites.image.toString('base64'),
            spritesheet_json: JSON.stringify(sprites.json)
        });

        return sprites;
    }

    /**
     * Given an array of icons, generate a spritesheet and return the JSON and image data
     *
     * @param icons - An array of icon objects, each containing a base64 encoded image
     */
    static async from_icons(icons: Array<Static<typeof IconResponse>>, spriteConfig: SpriteConfig = {}) {
        const src = [];
        for (const icon of icons) {
            const contents = await Sharp(Buffer.from(spriteConfig.useDataAlt && icon.data_alt ? icon.data_alt : icon.data, 'base64'))
                .resize(32, 32, {
                    fit: 'contain',
                    background: {r: 0, g: 0, b: 0, alpha: 0}
                })
                .png()
                .toBuffer();

            src.push(new Vinyl({
                // @ts-expect-error Deal with indexing issue on icon
                path: spriteConfig.name ? icon[spriteConfig.name] + '.png' : icon.path.replace(/.*?\//, ''),
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
}
