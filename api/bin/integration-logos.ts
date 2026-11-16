import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import pg from 'pg';
import sharp from 'sharp';

const SIZE = 256;
const out = process.argv[2] || 'integration-logos.sql';
const client = new pg.Client({ connectionString: process.env.POSTGRES || 'postgres:///tak_ps_etl' });
await client.connect();

const { rows } = await client.query<{ id: number; prefix: string; logo: string }>(
    'SELECT id, prefix, logo FROM integrations WHERE logo IS NOT NULL ORDER BY id',
);
await client.end();

const lines = [
    `-- Resize integration logos to ${SIZE}x${SIZE} PNG (fit: contain, transparent background)`,
    `-- Generated ${new Date().toISOString()} by api/bin/integration-logos.ts from ${rows.length} logos`,
    'BEGIN;',
];

for (const row of rows) {
    const match = row.logo.match(/^data:([^;]+);base64,(.+)$/s);
    if (!match) {
        console.error(`skip ${row.id} ${row.prefix}: not a base64 data URL`);
        continue;
    }

    if (match[1] === 'image/svg+xml') {
        console.error(`skip ${row.id} ${row.prefix}: svg`);
        continue;
    }

    try {
        const input = Buffer.from(match[2], 'base64');
        const meta = await sharp(input).metadata();
        const png = await sharp(input)
            .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .png({ compressionLevel: 9, palette: true })
            .toBuffer();

        const logo = `data:image/png;base64,${png.toString('base64')}`;
        lines.push(`-- ${row.prefix}: ${meta.format} ${meta.width}x${meta.height} ${row.logo.length} -> ${logo.length} chars`);
        lines.push(`UPDATE integrations SET logo = '${logo}', updated = Now() WHERE id = ${row.id} AND md5(logo) = '${md5(row.logo)}';`);
        console.error(`ok   ${row.id} ${row.prefix}: ${meta.format} ${meta.width}x${meta.height} ${row.logo.length} -> ${logo.length}`);
    } catch (err) {
        console.error(`skip ${row.id} ${row.prefix}: ${err instanceof Error ? err.message : err}`);
    }
}

lines.push('COMMIT;');
await fs.writeFile(out, lines.join('\n') + '\n');
console.error(`wrote ${out}`);

function md5(str: string): string {
    return crypto.createHash('md5').update(str).digest('hex');
}
