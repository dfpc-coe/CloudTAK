import {
    S3Client,
    ListObjectsV2Command,
    CopyObjectCommand,
    DeleteObjectCommand,
    HeadObjectCommand,
    ListObjectsV2CommandOutput,
} from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import fsp from 'node:fs/promises';

const s3 = new S3Client({});

async function* listS3Objects(
    bucket: string,
    prefix = ''
): AsyncGenerator<string> {
    let ContinuationToken: string | undefined = undefined;
    do {
        const resp: ListObjectsV2CommandOutput = await s3.send(
            new ListObjectsV2Command({
                Bucket: bucket,
                Prefix: prefix,
                ContinuationToken,
            })
        );
        for (const obj of resp.Contents ?? []) {
            if (obj.Key) yield obj.Key;
        }

        ContinuationToken = resp.IsTruncated ? resp.NextContinuationToken : undefined;
    } while (ContinuationToken);
}

// username/file without extension => UUID
const map = new Map<string, {
    uuid: string,
    artifacts: Array<{
        ext: string,
        size: number
    }>
}>();

async function main(bucket: string, host: string) {
    const migration = fs.createWriteStream(new URL('./migration.sql', import.meta.url));

    migration.write('BEGIN TRANSACTION;\n');

    for await (const key of listS3Objects(bucket, 'profile/')) {
        const [username, file] = key.split('/').slice(1, 3)

        const fileBase = path.parse(key).name;
        const fileExt = path.extname(key)

        const shard = `${username}/${fileBase}`;

        let existing;
        if (map.has(shard))
            existing = map.get(shard);
        else {
            existing = {
                uuid: randomUUID(),
                artifacts: []
            }

            map.set(shard, existing);
        }

        const newKey = `profile/${username}/${existing.uuid}${fileExt}`;
        console.error(`Renaming ${key} to ${newKey}`);

        try {
            await s3.send(new CopyObjectCommand({
                CopySource: `${bucket}/${key}`,
                Bucket: bucket,
                Key: newKey
            }));

            await s3.send(new DeleteObjectCommand({
                Bucket: bucket,
                Key: key
            }));

            const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: newKey }));

            if (['.geojsonld', '.pmtiles'].includes(fileExt)) {
                existing.artifacts.push({
                    ext: fileExt,
                    size: head.ContentLength
                })
            } else {
                migration.write(`INSERT INTO profile_files (username, id, name, size) VALUES ('${username}', '${existing.uuid}'::UUID, '${file.replace(/'/g, "''")}', ${head.ContentLength});\n`);
            }
        } catch (err) {
            console.error(`Error processing ${key}:`, err);
            continue;
        }
    }

    for (let [key, value] of map.entries()) {
        migration.write(`UPDATE profile_files SET artifacts = '${JSON.stringify(value.artifacts)}'::JSON WHERE id = '${value.uuid}'::UUID ;\n`);
    }

    migration.write(`UPDATE profile_overlays SET url = REPLACE(url, '${host}', '');\n`)

    migration.write(`
        CREATE OR REPLACE FUNCTION decode_url_part(p varchar) RETURNS varchar AS $$
        SELECT convert_from(CAST(E'\\x' || string_agg(CASE WHEN length(r.m[1]) = 1 THEN encode(convert_to(r.m[1], 'SQL_ASCII'), 'hex') ELSE substring(r.m[1] from 2 for 2) END, '') AS bytea), 'UTF8')
            FROM regexp_matches($1, '%[0-9a-f][0-9a-f]|.', 'gi') AS r(m);
        $$ LANGUAGE SQL IMMUTABLE STRICT;
    `)

    migration.write(`
        UPDATE profile_overlays
            SET url = '/api/profile/asset/' || profile_files.id || '.pmtiles/tile'
            FROM profile_files
            WHERE
                Starts_With(url, '/api/profile/asset/')
                AND profile_files.username = profile_overlays.username
                AND REGEXP_REPLACE(profile_files.name, '\.[^.]+$', '') = decode_url_part(Replace(Replace(url, '/api/profile/asset/', ''), '.pmtiles/tile', ''));
    `)

    migration.write(`DROP FUNCTION IF EXISTS decode_url_part(varchar);\n`);

    migration.write('COMMIT;\n');

    migration.close();
    console.log(`Migration file created at ${migration.path}`);
}

const bucket = process.argv[2]

// IE: https://map.cotak.gov
const host = process.argv[3]

if (!bucket || !host) {
    console.error('Usage: tsx index.ts <bucket> <host>');
    process.exit(1);
} else {
    console.log(`Processing bucket: ${bucket}`);
}

await main(bucket, host);
