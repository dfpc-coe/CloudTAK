import spritesmith from 'spritesmith';
import path from 'node:path'
import Vinyl from 'vinyl';
import Err from '@openaddresses/batch-error';
import { promisify } from 'node:util'
import { Static } from '@sinclair/typebox';
import Config from './config.js';
import { IconResponse } from './types.js';
import { sql } from 'drizzle-orm';
import Sharp from 'sharp';

const SpriteSmith = promisify(spritesmith.run);

type SpriteConfig = {
    name?: string;
};

const SUPPORTED_EXT = [
    '.svg',
    '.png'
];

const SUPPORTED_MIME = [
    'image/png',
    'image/svg+xml',
]

export default class SpriteBuilder {
    static async validate(
        icon: {
            name?: string;
            data?: string;
        }
    ): Promise<void> {
        if (icon.name) {
            const name = path.parse(icon.name)

            if (!SUPPORTED_EXT.includes(name.ext.toLowerCase())) {
                throw new Error('Icon file extension is not supported');
            }
        }

        if (icon.data) {
            if (!icon.data.startsWith('data:')) {
                throw new Error('Icon data is not valid base64 data URL (mission data: prefix)');
            }

            const supported = SUPPORTED_MIME.some((type) => {
                if (icon.data!.startsWith(`data:${type};base64,`)) {
                    return true;
                }
            });

            if (!supported) {
                throw new Error('Icon data is not a supported media type');
            }

            try {
                const img = Buffer.from(icon.data.split(',')[1] , 'base64');

                await Sharp(img)
                    .metadata();
            } catch (err) {
                console.error('Sprite Error', err);
                throw new Err(400, err instanceof Error ? err : new Error(String(err)), 'Failed to parse valid image');
            }
        }
    }

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
            const buff = Buffer.from(icon.data.split(',')[1], 'base64');

            const contents = await Sharp(buff)
                .resize({
                    width: 32,
                    height: 48,
                    fit: 'contain',
                    background: {
                        r: 0,
                        g: 0,
                        b: 0,
                        alpha: 0
                    }
                })
                .png()
                .toBuffer();

            // @ts-expect-error Deal with indexing issue on icon
            let path = spriteConfig.name ? icon[spriteConfig.name] + '.png' : icon.path.replace(/.*?\//, '');
            if (!path.endsWith('.png')) {
                if (path.indexOf('.') !== -1) {
                    path = path.replace(/\..*?$/, '.png');
                } else {
                    path = path + '.png';
                }
            }

            src.push(new Vinyl({ path, contents }))
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
