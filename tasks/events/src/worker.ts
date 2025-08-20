import { parentPort } from 'worker_threads';
import type { Import } from './types.js';
import jwt from 'jsonwebtoken';
import os from 'node:os';
import fsp from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import S3 from "@aws-sdk/client-s3";
import type { Import } from './types.js';
import StreamZip from 'node-stream-zip'
import type { StreamZipAsync } from 'node-stream-zip';
import { pipeline } from 'node:stream/promises';
//import API from './api.js';
import { CoTParser, DataPackage } from '@tak-ps/node-cot';
import xml2js from 'xml2js';

parentPort.on('message', async (message) => {
    try {
        const msg: {
            api: string
            bucket: string
            secret: string
            job: Import
        } = message;

        console.error('Import:', msg.job);

        // Use a user token to ensure data for a given user import doesn't exceed their ACL
        const token = jwt.sign({ access: 'user', email: msg.job.username }, msg.secret);

        const s3 = new S3.S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

        const tmpdir = fs.mkdtempSync(path.resolve(os.tmpdir(), 'cloudtak'));
        const ext = path.parse(msg.job.name).ext;
        const name = `${msg.job.id}${ext}`;
        const local = path.resolve(tmpdir, name);

        await pipeline(
            // @ts-expect-error 'StreamingBlobPayloadOutputTypes | undefined' is not assignable to parameter of type 'ReadableStream'
            (await s3.send(new S3.GetObjectCommand({
                Bucket: msg.bucket,
                Key: `import/${name}`,
            }))).Body,
            fs.createWriteStream(local)
        );

        const result = {};
        if (msg.job.mode === 'Mission') {
            if (!msg.job.config.id) throw new Error('No mission name defined');

            const res = await API.uploadMission(md, {
                name: msg.job.config.id,
                filename: msg.job.name,
                token
            });

            console.error(JSON.stringify(res));

            await API.updateImport(md, {
                status: 'Success',
                result
            });
        } else if (msg.job.mode === 'Package') {
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

                            console.log(`ok - uploading: s3://${msg.bucket}/attachment/${hash}/${name}`);
                            await s3.send(new S3.PutObjectCommand({
                                Bucket: msg.bucket,
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
            for (const file of files) {
                const name = path.parse(file).base;

                console.log(`ok - uploading: s3://${msg.bucket}/profile/${msg.job.username}/${name}`);
                await s3.send(new S3.PutObjectCommand({
                    Bucket: msg.bucket,
                    Key: `profile/${msg.job.username}/${name}`,
                    Body: await pkg.getFile(file)
                }))
            }

            await API.updateImport(md, {
                status: 'Success',
                result
            });
        } else if (msg.job.mode === 'Unknown') {
            if (ext === '.zip') {
                const zip = new StreamZip.async({
                    file: path.resolve(os.tmpdir(), local),
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

                if (indexes.length) {
                    for (const index of indexes) {
                        await processIndex(md, String(await zip.entryData(index)), zip);
                    }

                    await API.updateImport(md, {
                        status: 'Success',
                        result
                    });
                } else {
                    await submitBatch(md, msg.job)
                }
            } else if (ext === '.xml') {
                await processIndex(md, String(await fsp.readFile(local)));

                await API.updateImport(md, {
                    status: 'Success',
                    result
                });
            } else {
                await submitBatch(md, msg.job)
            }
        }
    } catch (err) {
        console.error('Error processing import:', err);

        parentPort.postMessage({
            type: 'error',
            error: err
        });
    }
});

async function submitBatch(event: Event, imported: Import) {
    console.log('ok - Treating as profile asset');

    const s3 = new S3.S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

    await s3.send(new S3.CopyObjectCommand({
        CopySource: `${event.Bucket}/${event.Key}`,
        Bucket: event.Bucket,
        Key: `profile/${imported.username}/${imported.name}`
    }))

    await API.createBatch(event, imported);
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
            headers: {
                'Authorization': `Bearer ${token}`
            },
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

        await API.updateImport(event, {
            status: 'Success',
            result: { url: `/iconset/${iconset.uid}` }
        });
    }
}
