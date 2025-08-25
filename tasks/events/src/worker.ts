import DataTransform from './transform.ts';
import { EventEmitter } from 'node:events'
import API from './api.ts';
import type { Message, LocalMessage } from './types.ts';
import jwt from 'jsonwebtoken';
import os from 'node:os';
import fsp from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import S3 from "@aws-sdk/client-s3";
import { pipeline } from 'node:stream/promises';
import { CoTParser, DataPackage } from '@tak-ps/node-cot';
import xml2js from 'xml2js';

export default class Worker extends EventEmitter {
    msg: Message;

    constructor(msg: Message) {
        super();

        this.msg = msg;
    }

    async process() {
        try {
            console.error(`Import: ${this.msg.job.id}`, JSON.stringify(this.msg.job));

            // Use a user token to ensure data for a given user import doesn't exceed their ACL
            const token = jwt.sign({ access: 'user', email: this.msg.job.username }, this.msg.secret);

            const s3 = new S3.S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

            const tmpdir = fs.mkdtempSync(path.resolve(os.tmpdir(), 'cloudtak'));
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

            if (this.msg.job.mode === 'Mission') {
                if (!this.msg.job.config.id) throw new Error('No mission name defined');

                const res = await API.uploadMission(md, {
                    name: this.msg.job.config.id,
                    filename: this.msg.job.name,
                    token
                });
            } else if (this.msg.job.mode === 'Package') {
                await processArchive(msg, local);
            } else if (this.msg.job.mode === 'Unknown') {
                if (ext === '.zip') {
                    await processArchive(msg, local);
                } else if (ext === '.xml') {
                    await processIndex(fsp.readFile(local));
                } else {
                    await this.processFile(local)
                }
            }

            this.emit('success');
        } catch (err) {
            console.error(`Import: ${this.msg.job.id} Error: `, err);

            this.emit('error', err);
        }
    }


    /**
     * Processes a zip file that may or may not be a DataPackage.
     * Zip Files that are not valid datapackages will be standardize to the same interface
     *
     * @param msg - Job Description Object
     */
    async processArchive(local: LocalMessage): Promise<void> {
        const pkg = await DataPackage.parse(local);

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
                token,
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
            const name = path.parse(file).base;

            if (path.parse(file).ext === '.xml') {
                indexes.push(entry);
            } else {
                await processFile(local);
                console.log(`ok - uploading: s3://${this.msg.bucket}/profile/${this.msg.job.username}/${name}`);
                    await s3.send(new S3.PutObjectCommand({
                    Bucket: this.msg.bucket,
                    Key: `profile/${this.msg.job.username}/${name}`,
                    Body: await pkg.getFile(file)
                }))
            }
        }

        if (indexes.length) {
            for (const index of indexes) {
                await processIndex(index);
            }
        }
    }

    /**
     * Processes a file upload for a user profile asset.
     *
     * @param msg - Job Description Object
     */
    async processFile(
        local: LocalMessage
    ): Promise<void> {
        console.log(`Import: ${this.msg.job.id} - uploading profile asset`);

        const s3 = new S3.S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

        const ext = path.parse(this.msg.job.name).ext;
        const name = `${this.msg.job.id}${ext}`;

        await s3.send(new S3.CopyObjectCommand({
            CopySource: `${this.msg.bucket}/import/${name}`,
            Bucket: this.msg.bucket,
            Key: `profile/${this.msg.job.username}/${this.msg.job.id}${path.parse(this.msg.job.name).ext}`,
        }))

        const transformer = new DataTransform(this.msg, local);

        await transformer.run();
    }

    /**
     * XML Files are typeically TAK Native documents describing how to import data into TAK
     * This function processes the XML file, determines the type and processes it accordingly
     *
     * @param msg   - Job Description Object
     * @param dp    - The DataPackage container
     * @param file  - The file path of the XML document
     */
    async processIndex(
        dp: DataPackage,
        file: string
    ): Promise<void> {
        const xml = await xml2js.parseStringPromise(xmlstr);

        if (xml.iconset) {
            if (!zip) throw new Error('Iconsets must be zipped');

            const iconset = {
                version: parseInt(xml.iconset.$.version),
                name: xml.iconset.$.name,
                default_group: xml.iconset.$.defaultGroup || null,
                default_friendly: xml.iconset.$.defaultFriendly || null,
                default_hostile: xml.iconset.$.defaultHostile || null,
                default_neutral: xml.iconset.$.defaultNeutral || null,
                default_unknown: xml.iconset.$.defaultUnknown || null,
                skip_resize: xml.iconset.$.skipResize === "true" ? true : false,
                uid: xml.iconset.$.uid
            }

            const check = await fetch(new URL(`/api/iconset/${iconset.uid}`, process.env.TAK_ETL_API), {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
            });

            if (check.status === 200) {
                throw new Error(`Iconset ${iconset.name} (${iconset.uid}) already exists`);
            }

            const iconset_req = await fetch(new URL(`/api/iconset`, process.env.TAK_ETL_API), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(iconset)
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
                const icon_req = await fetch(new URL(`/api/iconset/${iconset.uid}/icon`, process.env.TAK_ETL_API), {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
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
        }
    }
}

