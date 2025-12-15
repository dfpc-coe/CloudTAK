import Config from './config.js';
import path from 'node:path';
import {
    Basemap as BasemapParser,
    Iconset as IconsetParser,
    DataPackage
} from '@tak-ps/node-cot'
import fs from 'node:fs/promises';

/**
 * Break ground on populating an empty database
 */
export default class Bulldozer {
    config: Config;

    constructor(config: Config) {
        this.config = config;
    }

    static async fireItUp(config: Config): Promise<void> {
        const bulldozer = new Bulldozer(config);

        await Promise.allSettled([
            bulldozer.populateIconsets(),
            bulldozer.populateBasemaps()
        ]);
    }

    async populateIconsets(): Promise<void> {
        const count = await this.config.models.Iconset.count();
        if (count === 0) {
            try {
                await fs.access(new URL('../data/', import.meta.url));

                for (const file of await fs.readdir(new URL('../data/iconsets/', import.meta.url))) {
                    console.error(`ok - loading iconset ${file}`);

                    const dp = await DataPackage.parse(new URL(`../data/iconsets/${file}`, import.meta.url), {
                        strict: false
                    });

                    const files = await dp.files();
                    if (!files.has('iconset.xml')) continue;

                    const lookup = new Map();
                    for (const icon of files) {
                        lookup.set(path.parse(icon).base, icon);
                    }

                    const iconset = await IconsetParser.parse(await dp.getFileBuffer('iconset.xml'));
                    await this.config.models.Iconset.generate(iconset.to_json())

                    for (const icon of iconset.icons()) {
                        const file = lookup.get(icon.name) || icon.name;

                        if (!files.has(file)) {
                            console.log(`not ok - could not find ${icon.name} in ${iconset.name}, skipping`);
                            continue;
                        }

                        const iconBuff = await dp.getFileBuffer(file)

                        if (!iconBuff) {
                            console.log(`not ok - could not open ${icon.name} in ${iconset.name}, skipping`);
                            continue;
                        }

                        const parsed = path.parse(file);
                        const name = parsed.name;
                        const format = parsed.ext.toLowerCase();

                        this.config.models.Icon.generate({
                            iconset: iconset.uid,
                            name,
                            format,
                            type2525b: icon.type2525b,
                            data: `data:image/png;base64,${iconBuff.toString('base64')}`,
                            path: `${iconset.uid}/${file}`
                        })
                    }
                }
            } catch (err) {
                if (err instanceof Error && (err as NodeJS.ErrnoException).code === 'ENOENT') {
                    console.log('ok - could not automatically load iconsets');
                } else {
                    console.error(err);
                }
            }
        }

    }

    async populateBasemaps(): Promise<void> {
        const count = await this.config.models.Basemap.count();
        if (count === 0) {
            try {
                await fs.access(new URL('../data/', import.meta.url));

                for (const file of await fs.readdir(new URL('../data/basemaps/', import.meta.url))) {
                    console.error(`ok - loading basemap ${file}`);
                    const b = (await BasemapParser.parse(String(await fs.readFile(new URL(`../data/basemaps/${file}`, import.meta.url))))).to_json();

                    await this.config.models.Basemap.generate({
                        name: b.name || 'Unknown',
                        url: b.url,
                        minzoom: b.minZoom || 0,
                        maxzoom: b.maxZoom || 16
                    })
                }
            } catch (err) {
                if (err instanceof Error && (err as NodeJS.ErrnoException).code === 'ENOENT') {
                    console.log('ok - could not automatically load basemaps');
                } else {
                    console.error(err);
                }
            }
        }
    }
}
