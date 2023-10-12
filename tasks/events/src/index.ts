import os from 'node:os';
import fsp from 'node:fs/promises';
import fs from 'node:fs';
import Lambda from "aws-lambda";
import path from 'node:path';
import S3 from "@aws-sdk/client-s3";
import StreamZip, { StreamZipAsync } from 'node-stream-zip'
import { pipeline } from 'node:stream/promises';
import xml2js from 'xml2js';
import jwt from 'jsonwebtoken';

interface Event {
    Import: string;
    Token: string;
    Bucket: string;
    Key: string;
    Ext: string;
    Local: string;
}

export const handler = async (
    event: Lambda.S3Event,
): Promise<void> => {

    for (const record of event.Records) {
        const md = {
            Import: path.parse(decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '))).name,
            Token: jwt.sign({ access: 'event' }, String(process.env.SigningSecret)),
            Bucket: record.s3.bucket.name,
            Key: decodeURIComponent(record.s3.object.key.replace(/\+/g, ' ')),
            Ext: path.parse(decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '))).ext,
            Local: path.resolve(os.tmpdir(), `input${path.parse(decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '))).ext}`),
        }

        try {
            console.log(`ok - New file detected in s3://${md.Bucket}/${md.Key}`);

            if (!md.Key.startsWith('import/')) {
                console.log(`ok - Not an import - skipping`);
                return;
            }

            const s3 = new S3.S3Client({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });

            await pipeline(
                // @ts-ignore
                (await s3.send(new S3.GetObjectCommand({
                    Bucket: md.Bucket,
                    Key: md.Key
                }))).Body,
                fs.createWriteStream(md.Local)
            );

            if (md.Ext === '.zip') {
                const zip = new StreamZip.async({
                    file: path.resolve(os.tmpdir(), md.Local),
                    skipEntryNameValidation: true
                });

                const preentries = await zip.entries();

                const indexes = [];
                for (const entrykey in preentries) {
                    const entry = preentries[entrykey];

                    if (path.parse(entry.name).ext === '.xml') {
                        indexes.push(entry);
                    }
                }

                for (const index of indexes) {
                    await processIndex(md, String(await zip.entryData(index)), zip);
                }
            } else if (md.Ext === '.xml') {
                await processIndex(md, String(await fsp.readFile(md.Local)));
            } else {
                throw new Error('Unable to parse Index');
            }
        } catch (err) {
            console.error(err);

            await updateImport(md, {
                status: 'Fail',
                error: err instanceof Error ? err.message : String(err)
            });
        }
    }
};

async function updateImport(event: Event, body: object) {
    const res = await fetch(new URL(`/api/import/${event.Import}`, process.env.TAK_ETL_API), {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${event.Token}`
        },
        body: JSON.stringify(body)
    });

    console.log(await res.text());
}

async function processIndex(event: Event, xmlstr: string, zip?: StreamZipAsync) {
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
        });

        if (check.status === 200) {
            await updateImport(event, {
                status: 'Fail',
                message: `Iconset ${iconset.name} (${iconset.uid}) already exists`
            });
            return;
        }

        await fetch(new URL(`/api/iconset`, process.env.TAK_ETL_API), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${event.Token}`
            },
            body: JSON.stringify(iconset)
        });

        // Someone decided that the icon name should be the name without the folder prefix
        // This was a dumb idea and this code tries to match 1:1 without the prefix
        const icons = await zip.entries();
        const lookup = new Map();
        for (const icon in icons) {
            lookup.set(path.parse(icon.name).base, icon);
        }


        for (const icon of xml.iconset.icon) {
            await fetch(new URL(`/api/iconset/${iconset.uid}/icon`, process.env.TAK_ETL_API), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${event.Token}`
                },
                body: JSON.stringify({
                    name: icon.$.name,
                    path: `${iconset.uid}/${icon.$.name}`,
                    type2525b: icon.$.type2525b || null,
                    data: (await zip.entryData(lookup.get(icon.$.name))).toString('base64')
                })
            });
        }
    }
}
