import os from 'node:os';
import { fetch } from 'undici';
import fsp from 'node:fs/promises';
import fs from 'node:fs';
import Lambda from "aws-lambda";
import path from 'node:path';
import S3 from "@aws-sdk/client-s3";
import StreamZip, { StreamZipAsync } from 'node-stream-zip'
import { includesWithGlob } from "array-includes-with-glob";
import { pipeline } from 'node:stream/promises';
import xml2js from 'xml2js';
import jwt from 'jsonwebtoken';
import API from './api.js';

export type Event = {
    ID?: string;
    Token?: string;
    Bucket: string;
    Key: string;
    Name: string;
    Ext: string;
    Local: string;
}

export const handler = async (
    event: {
        Records: Lambda.SQSRecord[] | Lambda.S3EventRecord[]
    }
): Promise<void> => {
    for (const record of event.Records) {
        if (Object.keys(record).includes('s3')) {
            await s3Event(record as Lambda.S3EventRecord)
        } else if (Object.keys(record).includes('body')) {
            await sqsEvent(record as Lambda.SQSRecord);
        }
    }
};

async function sqsEvent(record: Lambda.SQSRecord) {
    console.error(record);
}

async function s3Event(record: Lambda.S3EventRecord) {
    const md: Event = {
        Bucket: record.s3.bucket.name,
        Key: decodeURIComponent(record.s3.object.key.replace(/\+/g, ' ')),
        Name: path.parse(decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '))).name,
        Ext: path.parse(decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '))).ext,
        Local: path.resolve(os.tmpdir(), `input${path.parse(decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '))).ext}`),
    };

    return await genericEvent(md)
}

async function genericEvent(md: Event) {
    console.log(`ok - New file detected in s3://${md.Bucket}/${md.Key}`);
    if (md.Key.startsWith('import/')) {
        try {
            md.ID = path.parse(md.Key).name;
            md.Token = `etl.${jwt.sign({ access: 'import' , id: md.ID, internal: true }, String(process.env.SigningSecret))}`;

            await API.updateImport(md, { status: 'Running' });
            const imported = await API.fetchImport(md);

            console.error('Import', JSON.stringify(imported));

            const s3 = new S3.S3Client({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
            await pipeline(
                // @ts-ignore
                (await s3.send(new S3.GetObjectCommand({
                    Bucket: md.Bucket,
                    Key: md.Key
                }))).Body,
                fs.createWriteStream(md.Local)
            );

            const result = {};
            if (imported.mode === 'Mission') {
                if (!imported.config.id) throw new Error('No mission name defined');
                if (!imported.config.token) throw new Error('No token defined');

                const res = await API.uploadMission(md, {
                    name: imported.config.id,
                    filename: imported.name,
                    token: imported.config.token
                });

                console.error(JSON.stringify(res));
            } else if (imported.mode === 'Unknown') {
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
            }

            await API.updateImport(md, {
                status: 'Success',
                result
            });
        } catch (err) {
            console.error(err);

            await API.updateImport(md, {
                status: 'Fail',
                error: err instanceof Error ? err.message : String(err)
            });
        }
    } else if (md.Key.startsWith('data/')) {
        md.ID = path.parse(md.Key).dir.replace('data/', '');
        md.Token = `etl.${jwt.sign({ access: 'data' , id: parseInt(md.ID), internal: true }, String(process.env.SigningSecret))}`;

        const data = await API.fetchData(md);

        if (data.mission_sync && !['.geojsonld', '.pmtiles'].includes(md.Ext)) {
            let sync = false;
            for (const glob of data.assets) {
                sync = includesWithGlob([md.Name], glob);
                if (sync) break;
            }

            if (sync) {
                console.log(`ok - Data ${md.Key} syncing with ${data.name}`);
                const s3 = new S3.S3Client({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
                await pipeline(
                    // @ts-ignore
                    (await s3.send(new S3.GetObjectCommand({
                        Bucket: md.Bucket,
                        Key: md.Key
                    }))).Body,
                    fs.createWriteStream(md.Local)
                );

                console.log(`ok - Data ${md.Key} posting to mission ${data.name}`);
                const res = await API.uploadDataMission(md, {
                    filename: md.Name,
                    connection: data.connection
                });

                console.log(JSON.stringify(res));
            } else {
                console.log(`ok - Data ${md.Key} does not match mission sync globs`);
            }
        } else {
                console.log(`ok - Data ${md.Key} has no mission assigned or is a geojsonld or pmtiles file`);
        }

        if (data.auto_transform) {
            await API.transformData(md, {
                connection: data.connection
            });
        } else {
            console.log(`ok - Data ${md.ID} has auto-transform turned off`);
        }

    } else {
        throw new Error('Unknown Import Type');
    }
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
            await API.updateImport(event, {
                status: 'Fail',
                message: `Iconset ${iconset.name} (${iconset.uid}) already exists`
            });
            return;
        }

        const iconset_req = await fetch(new URL(`/api/iconset`, process.env.TAK_ETL_API), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${event.Token}`
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
                    'Authorization': `Bearer ${event.Token}`
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

        await API.updateImport(event, {
            status: 'Success',
            result: { url: `/iconset/${iconset.uid}` }
        });
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    try {
        const dotfile = new URL('../.env', import.meta.url);
        fs.accessSync(dotfile);
        Object.assign(process.env, JSON.parse(String(fs.readFileSync(dotfile))));
        console.log('ok - .env file loaded');
    } catch (err) {
        console.log('ok - no .env file loaded');
    }


    if (!process.env.KEY) throw new Error('KEY env var must be set');
    if (!process.env.BUCKET) throw new Error('BUCKET env var must be set');
    process.env.SigningSecret = 'coe-wildland-fire'

    await genericEvent({
        Bucket: process.env.BUCKET,
        Key: process.env.KEY,
        Name: path.parse(process.env.KEY).name,
        Ext: path.parse(process.env.KEY).ext,
        Local: path.resolve(os.tmpdir(), `input${path.parse(process.env.KEY).ext}`),
    });
}
