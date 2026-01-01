import DataTransform from './transform.ts';
import { isZipFile } from './sniff.ts';
import { rimraf } from 'rimraf';
import { randomUUID } from 'node:crypto';
import { Upload } from '@aws-sdk/lib-storage';
import { EventEmitter } from 'node:events'
import type { Message, LocalMessage, Asset } from './types.ts';
import jwt from 'jsonwebtoken';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import s3client from "./s3.ts";
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { pipeline } from 'node:stream/promises';
import { CoTParser, DataPackage, Iconset, Basemap } from '@tak-ps/node-cot';

export default class Worker extends EventEmitter {
    msg: Message;

    constructor(msg: Message) {
        super();

        this.msg = msg;
    }

    async process() {
        let local: LocalMessage | undefined = undefined;

        try {
            console.error(`Import: ${this.msg.job.id}`, JSON.stringify(this.msg.job));

            const s3 = s3client();

            const tmpdir = fs.mkdtempSync(path.resolve(os.tmpdir(), 'cloudtak-'));
            const { ext } = path.parse(this.msg.job.name);
            const name = `${this.msg.job.id}${ext}`;

            local = {
                id: this.msg.job.id,
                ext,
                name: this.msg.job.name,
                tmpdir,
                raw: path.resolve(tmpdir, name)
            }

            await pipeline(
                // @ts-expect-error 'StreamingBlobPayloadOutputTypes | undefined' is not assignable to parameter of type 'ReadableStream'
                (await s3.send(new GetObjectCommand({
                    Bucket: this.msg.bucket,
                    Key: `import/${local.id}${local.ext}`,
                }))).Body,
                fs.createWriteStream(local.raw)
            );

            if (await isZipFile(local.raw)) {
                await this.processArchive(local);
            } else {
                await this.processFile(local)
            }

            if (local) await rimraf(local.tmpdir);

            this.emit('success');
        } catch (err) {
            console.error(`import: ${this.msg.job.id} Error: `, err);

            if (local) await rimraf(local.tmpdir);

            this.emit('error', err);
        }
    }


    /**
     * Processes a zip file that may or may not be a DataPackage.
     * Zip Files that are not valid datapackages will be standardize to the same interface
     *
     * @param local - Local File Information Object
     */
    async processArchive(local: LocalMessage): Promise<void> {
        const pkg = await DataPackage.parse(local.raw, {
            cleanup: false,
            strict: false
        });

        // If a .kml is present at the root level, assume an actual KMZ and process as a single file upload
        if (pkg.contents.some((content) => {
            const p = path.parse(content._attributes.zipEntry);
            return !p.dir && p.ext.toLowerCase() === '.kml'
        })) {
            return await this.processFile(local)
        }

        // We disable cleanup in the parser just in case we choose to
        // treat it as a single file upload above
        fs.unlinkSync(local.raw);

        const s3 = s3client();

        const cots = await pkg.cots();
        for (const cot of cots) {
            const feat = await CoTParser.to_geojson(cot);

            if (feat.properties.attachments) {
                const attachments = await pkg.attachments();
                for (const uid of attachments.keys()) {
                    const contents = attachments.get(uid);
                    if (!contents || !contents.length) continue;

                    for (const content of contents) {
                        const hash = await pkg.hash(content._attributes.zipEntry)
                        const name = path.parse(content._attributes.zipEntry).base;

                        console.log(`ok - uploading: s3://${this.msg.bucket}/attachment/${hash}/${name}`);
                            await s3.send(new PutObjectCommand({
                            Bucket: this.msg.bucket,
                            Key: `attachment/${hash}/${name}`,
                            Body: await pkg.getFile(content._attributes.zipEntry)
                        }))
                    }
                }
            }

            const url = new URL(`/api/profile/feature`, this.msg.api);
            url.searchParams.append('broadcast', String(true));
            const res = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${jwt.sign({ access: 'user', email: this.msg.job.username }, this.msg.secret)}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ...feat,
                    path: `/${pkg.settings.name.replace(/\//g, '')}/`,
                })
            });

            if (!res.ok) {
                const json = (await res.json()) as { message: string };
                console.error(json.message);
            }
        }

        const files = await pkg.files();
        const indexes = [];

        for (const file of files) {
            const { ext, base } = path.parse(file);

            if (base !== 'MANIFEST.xml' && ext === '.xml') {
                indexes.push(file);
            } else {
                if (base === 'MANIFEST.xml') continue;
                if (['.png', '.xml'].includes(ext)) continue;

                await this.processFile({
                    id: randomUUID(),
                    tmpdir: pkg.path,
                    ext: ext,
                    name: base,
                    raw: path.resolve(pkg.path, './raw/', file)
                });
            }
        }

        if (indexes.length) {
            for (const index of indexes) {
                await this.processIndex(pkg, index);
            }
        }

        await pkg.destroy();
    }

    /**
     * Processes a file upload for a user profile asset.
     *
     * @param local - Local File Information Object
     */
    async processFile(
        local: LocalMessage,
    ): Promise<void> {
        console.log(`Import: ${this.msg.job.id} - uploading profile asset`);

        const s3 = s3client();

        const id = randomUUID();

        const geouploader = new Upload({
            client: s3,
            params: {
                Bucket: this.msg.bucket,
                Key: `profile/${this.msg.job.username}/${id}${local.ext}`,
                Body: fs.createReadStream(local.raw)
            }
        });

        await geouploader.done();

        const res = await fetch(new URL(`/api/profile/asset`, this.msg.api), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${jwt.sign({ access: 'user', email: this.msg.job.username }, this.msg.secret)}`,
            },
            body: JSON.stringify({
                id,
                // It is important that the ext of the name is the same as the uploaded file
                name: local.name,
                // TODO Use Data Package Prefix
                path: '/',
            })
        });

        if (!res.ok) throw new Error(await res.text());

        const asset = await res.json() as Asset;

        const transformer = new DataTransform(
            this.msg,
            local,
            asset
        );

        await transformer.run();
    }

    /**
     * XML Files are typeically TAK Native documents describing how to import data into TAK
     * This function processes the XML file, determines the type and processes it accordingly
     *
     * @param dp    - The DataPackage container
     * @param file  - The file path of the XML document
     */
    async processIndex(
        pkg: DataPackage,
        file: string
    ): Promise<void> {
        const xml = (await pkg.getFileBuffer(file)).toString();

        try {
            const iconset = await Iconset.parse(xml);

            const check = await fetch(new URL(`/api/iconset/${iconset.uid}`, this.msg.api), {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${jwt.sign({ access: 'user', email: this.msg.job.username }, this.msg.secret)}`,
                },
            });

            if (check.status === 200) {
                throw new Error(`Iconset ${iconset.name} (${iconset.uid}) already exists`);
            }

            const iconset_req = await fetch(new URL(`/api/iconset`, this.msg.api), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${jwt.sign({ access: 'user', email: this.msg.job.username }, this.msg.secret)}`,
                },
                body: JSON.stringify(iconset.to_json())
            });

            if (!iconset_req.ok) throw new Error(await iconset_req.text());

            // Someone decided that the icon name should be the name without the folder prefix
            // This was a dumb idea and this code tries to match 1:1 without the prefix
            const files = await pkg.files();
            const lookup = new Map();

            for (const file of files) {
                if (!['.png', '.svg'].includes(path.parse(file).ext)) {
                    continue;
                }
                lookup.set(path.parse(file).base, file);
            }

            for (const icon of iconset.icons()) {
                const ext = path.parse(icon.name).ext;

                let prefix = 'data:';
                if (ext === '.png') {
                    prefix += 'image/png;base64,';
                } else if (ext === '.svg') {
                    prefix += 'image/svg+xml;base64,';
                } else {
                    console.warn(`Iconset ${iconset.name} (${iconset.uid}) - Unsupported icon type for ${icon.name}: ${ext}`);
                    continue;
                }

                const icon_req = await fetch(new URL(`/api/iconset/${iconset.uid}/icon`, this.msg.api), {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${jwt.sign({ access: 'user', email: this.msg.job.username }, this.msg.secret)}`,
                    },
                    body: JSON.stringify({
                        name: lookup.get(icon.name),
                        path: `${iconset.uid}/${lookup.get(icon.name)}`,
                        type2525b: icon.type2525b || null,
                        data: `${prefix}${(await pkg.getFileBuffer(lookup.get(icon.name))).toString('base64')}`
                    })
                });

                if (!icon_req.ok) console.error(await icon_req.text());
            }
        } catch (err) {
            console.log(`Import: ${this.msg.job.id} - ${file} is not an Iconset:`, err instanceof Error ? err.message : String(err));
        }

        try {
            const basemap = await Basemap.parse(xml);
            const json = basemap.to_json();

            const basemap_req = await fetch(new URL(`/api/basemap`, this.msg.api), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${jwt.sign({ access: 'user', email: this.msg.job.username }, this.msg.secret)}`,
                },
                body: JSON.stringify({
                    name: json.name,
                    url: json.url,
                    minzoom: json.minZoom,
                    maxzoom: json.maxZoom,
                    format: json.tileType,
                })
            });

            if (!basemap_req.ok) console.error(await basemap_req.text());
        } catch (err) {
            console.log(`Import: ${this.msg.job.id} - ${file} is not a Basemap:`, err instanceof Error ? err.message : String(err));
        }
    }
}

