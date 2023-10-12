import os from 'node:os';
import fs from 'node:fs';
import Lambda from "aws-lambda";
import path from 'node:path';
//import jwt from 'jsonwebtoken';
import S3 from "@aws-sdk/client-s3";
import StreamZip, { ZipEntry } from 'node-stream-zip'
import { pipeline } from 'node:stream/promises';
import asyncPool from 'tiny-async-pool';
import xml2js from 'xml2js';

export const handler = async (
    event: Lambda.S3NotificationEvent,
): Promise<Lambda.APIGatewayProxyResult> => {
    for (const record of event.Records) {
        const md = {
            Bucket: record.s3.bucket.name,
            Key: decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '))
        }
        console.log(`ok - New file detected in ${md.Bucket}: ${md.Key}`);

        if (!md.Key.startsWith('import/')) {
            console.log(`ok - Not an import - skipping`);
            return;
        }

        const s3 = new S3.S3Client({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });

        md.Ext = path.parse(md.Key).ext;
        md.Local = path.resolve(os.tmpdir(), `input${md.Ext}`);

        await pipeline(
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

            const entries = new Map();
            const indexes = [];
            for (const entrykey in preentries) {
                const entry = preentries[entrykey];

                if (path.parse(entry.name).ext === '.xml') {
                    indexes.push(entry);
                } else {
                    entries.set(entry.name, entry);
                }
            }

            for (const index of indexes) {
                await processIndex(String(await zip.entryDate(index)), entries);
            }

            /*
            for await (const ms of asyncPool(1000, entries, async (entry) => {
                console.error(entry)
                const data = await zip.entryData(entry);
            })) {
                console.log(ms);
            }
            */
        } else if (md.Ext === '.xml') {
            await processIndex(String(await zip.entryDate(index)), new Map());
        } else {
            throw new Error('Unable to parse Index');
        }
    }
};

async function processIndex(xml: string, entries: Map<string, ZipEntry>) {
    xml = await xml2js.parseStringPromise(xml);
    console.error(JSON.stringify(xml));
}
