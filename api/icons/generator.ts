import xmljs from 'xml-js';
import fs from 'node:fs/promises';
import path from 'node:path';
import Sprites from '../lib/sprites.js';
import Sharp from 'sharp';

const iconset = new Array();

const files = await fs.readdir(new URL('./custom', import.meta.url));

for (const file of files) {
    const img = await Sharp(Buffer.from(await fs.readFile(new URL(`../icons/custom/${file}`, import.meta.url))))
        .resize(32)
        .png()
        .toBuffer();

    iconset.push({
        id: path.parse(file).name,
        name: path.parse(file).name,
        file: file,
        parent: '',
        data: img.toString('base64'),
        children: []
    });
}

for (const icon of xmljs.xml2js(String(await fs.readFile(new URL('../icons/icons.xml', import.meta.url))), {
    compact: true
// @ts-ignore
}).icons.icon) {
    if (!icon.filePath || !icon.filePath._text) continue;

    const img = await Sharp(Buffer.from(await fs.readFile(new URL(`../icons/${path.parse(icon.filePath._text).base}`, import.meta.url))))
        .resize(32)
        .png()
        .toBuffer();

    const item = {
        id: `a-` + icon.id._text,
        name: icon.displayName._text,
        file: path.parse(icon.filePath._text).base,
        parent: icon.parentID._text,
        data: img.toString('base64'),
        children: (icon.childrenIDs && Array.isArray(icon.childrenIDs.id)) ? icon.childrenIDs.id.map((id: { _text: string }) => {
            return id._text;
        }) : []
    };

    iconset.push(item);
}

let i = 0;
const defaultSprites = await Sprites(
    iconset.map((icon) => {
        return {
            id: ++i,
            iconset: 'default',
            path: 'default',
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            name: icon.name,
            type2525b: icon.id,
            data: icon.data
        }
    }),
    { name: 'type2525b' }
);

await fs.writeFile(new URL('./generator.json', import.meta.url), JSON.stringify(defaultSprites.json));
await fs.writeFile(new URL('./generator.png', import.meta.url), defaultSprites.image);
