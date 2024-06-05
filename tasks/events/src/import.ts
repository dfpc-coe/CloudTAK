import os from 'node:os';
import fsp from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import S3 from "@aws-sdk/client-s3";
import StreamZip, { StreamZipAsync } from 'node-stream-zip'
import { pipeline } from 'node:stream/promises';
import jwt from 'jsonwebtoken';
import API from './api.js';
import { DataPackage } from '@tak-ps/node-cot';
import xml2js from 'xml2js';
import { Event } from './index.js';

export default async function(md: Event) {
    try {
        md.ID = path.parse(md.Key).name;
        md.Token = `etl.${jwt.sign({ access: 'import' , id: md.ID, internal: true }, String(process.env.SigningSecret))}`;

        await API.updateImport(md, { status: 'Running' });
        const imported = await API.fetchImport(md);

        console.error('Import', JSON.stringify(imported));

        md.UserToken = jwt.sign({ access: 'user', email: imported.username }, String(process.env.SigningSecret));

        const s3 = new S3.S3Client({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
        await pipeline(
            // @ts-expect-error 'StreamingBlobPayloadOutputTypes | undefined' is not assignable to parameter of type 'ReadableStream'
            (await s3.send(new S3.GetObjectCommand({
                Bucket: md.Bucket,
                Key: md.Key
            }))).Body,
            fs.createWriteStream(md.Local)
        );

        const result = {};
        if (imported.mode === 'Mission') {
            if (!imported.config.id) throw new Error('No mission name defined');

            const res = await API.uploadMission(md, {
                name: imported.config.id,
                filename: imported.name,
                token: md.UserToken
            });

            console.error(JSON.stringify(res));
        } else if (imported.mode === 'Package') {
            const pkg = await DataPackage.parse(md.Local);

            // TODO Support Geospatial Files
            const feats = await pkg.cots();
            for (const feat of feats) {
                await API.putFeature({
                    token: md.UserToken,
                    body: feat.to_geojson()
                });
            }

            console.error('Package', feats);
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
                'Authorization': `Bearer ${event.UserToken}`
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
                'Authorization': `Bearer ${event.UserToken}`
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
                    'Authorization': `Bearer ${event.UserToken}`
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

