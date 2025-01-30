import os from 'node:os';
import fs from 'node:fs';
import Lambda from "aws-lambda";
import path from 'node:path';
import S3 from "@aws-sdk/client-s3";
import { includesWithGlob } from "array-includes-with-glob";
import { pipeline } from 'node:stream/promises';
import Import from './import.js';
import jwt from 'jsonwebtoken';
import API from './api.js';

export type Event = {
    ID?: string;
    Token?: string;
    UserToken?: string;
    Bucket: string;
    Key: string;
    Name: string;
    Ext: string;
    Local: string;
}

export const handler = async (
    event: {
        Records: Lambda.S3EventRecord[]
    }
): Promise<void> => {
    if (!event.Records) {
        console.error('No Records: ', JSON.stringify(event));
        throw new Error('No Records');
    }

    for (const record of event.Records) {
        if (Object.keys(record).includes('s3')) {
            await s3Event(record as Lambda.S3EventRecord)
        } else {
            console.log('Unknown Source', JSON.stringify(record));
            throw new Error('Unknown Source');
        }
    }
};

async function s3Event(record: Lambda.S3EventRecord) {
    const md: Event = {
        Bucket: record.s3.bucket.name,
        Key: decodeURIComponent(record.s3.object.key.replace(/\+/g, ' ')),
        Name: path.parse(decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '))).base,
        Ext: path.parse(decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '))).ext,
        Local: path.resolve(os.tmpdir(), `input${path.parse(decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '))).ext}`),
    };

    return await genericEvent(md)
}

async function genericEvent(md: Event) {
    console.log(`ok - New file detected in s3://${md.Bucket}/${md.Key}`);
    if (md.Key.startsWith('import/')) {
        await Import(md);
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
                    // @ts-expect-error 'StreamingBlobPayloadOutputTypes | undefined' is not assignable to parameter of type 'ReadableStream'
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

if (import.meta.url === `file://${process.argv[1]}`) {
    try {
        const dotfile = new URL('../.env', import.meta.url);
        fs.accessSync(dotfile);
        Object.assign(process.env, JSON.parse(String(fs.readFileSync(dotfile))));
        console.log('ok - .env file loaded');
    } catch (err) {
        if (!String(err).includes('ENOENT')) {
            console.error(`ok - env file error (${err})`);
        }
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
