import DataTransform from './transform.ts';
import { randomUUID } from 'node:crypto';
import { Upload } from '@aws-sdk/lib-storage';
import { EventEmitter } from 'node:events'
import API from './api.ts';
import type { Message, LocalMessage, Asset } from './types.ts';
import jwt from 'jsonwebtoken';
import os from 'node:os';
import fsp from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import S3 from "@aws-sdk/client-s3";
import { pipeline } from 'node:stream/promises';
import { CoTParser, DataPackage, Iconset, Basemap } from '@tak-ps/node-cot';

export default class Worker extends EventEmitter {
    msg: Message;

    constructor(msg: Message) {
        super();

        this.msg = msg;
    }

    async process() {
        try {
            console.error(`Import: ${this.msg.job.id}`, JSON.stringify(this.msg.job));

            const s3 = new S3.S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

            const tmpdir = fs.mkdtempSync(path.resolve(os.tmpdir(), 'cloudtak-'));
            const ext = path.parse(this.msg.job.name).ext;
            const name = `${this.msg.job.id}${ext}`;

            const local: LocalMessage = {
                ext, name, tmpdir,
                raw: path.resolve(tmpdir, name)
            }

            await pipeline(
                // @ts-expect-error 'StreamingBlobPayloadOutputTypes | undefined' is not assignable to parameter of type 'ReadableStream'
                (await s3.send(new S3.GetObjectCommand({
                    Bucket: this.msg.bucket,
                    Key: `import/${local.name}`,
                }))).Body,
                fs.createWriteStream(local.raw)
            );

            if (ext === '.zip') {
                await this.processArchive(local);
            } else if (ext === '.xml') {
                await this.processIndex(fsp.readFile(local));
            } else {
                await this.processFile(local)
            }

            // TODO REMOVE tMP DIR

            this.emit('success');
        } catch (err) {
            console.error(`import: ${this.msg.job.id} Error: `, err);

            // TODO REMOVE tMP DIR

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
            strict: false
        });

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
                            await s3.send(new S3.PutObjectCommand({
                            Bucket: this.msg.bucket,
                            Key: `attachment/${hash}/${name}`,
                            Body: await pkg.getFile(content._attributes.zipEntry)
                        }))
                    }
                }
            }

            await API.putFeature({
                token: jwt.sign({ access: 'user', email: this.msg.job.username }, this.msg.secret),
                broadcast: true,
                body: {
                    ...feat,
                    path: `/${pkg.settings.name.replace(/\//g, '')}/`,
                }
            });
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

        const s3 = new S3.S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

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
                name: local.name,
                path: '/', // TODO Use Data Package Prefix
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
        dp: DataPackage,
        file: string
    ): Promise<void> {
        const xml = (await dp.getFileBuffer(file)).toString();

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
            const icons = await zip.entries();
            const lookup = new Map();
            for (const icon in icons) {
                lookup.set(path.parse(icons[icon].name).base, icons[icon]);
            }

            for (const icon of xml.iconset.icon) {
                const icon_req = await fetch(new URL(`/api/iconset/${iconset.uid}/icon`, this.msg.api), {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${jwt.sign({ access: 'user', email: this.msg.job.username }, this.msg.secret)}`,
                    },
                    body: JSON.stringify({
                        name: lookup.get(icon.$.name).name,
                        path: `${iconset.uid}/${lookup.get(icon.$.name).name}`,
                        type2525b: icon.$.type2525b || null,
                        data: (await zip.entryData(lookup.get(icon.$.name))).toString('base64')
                    })
                });

                if (!icon_req.ok) console.error(await icon_req.text());
            }
        } catch (err) {
            console.log(`Import: ${this.msg.job.id} - ${file} is not an Iconset:`, err.message);
        }

        try {
            const basemap = await Basemap.parse(xml);

            // TODO save to profile
        } catch (err) {
            console.log(`Import: ${this.msg.job.id} - ${file} is not a Basemap:`, err.message);
        }
    }
}

