import fs from 'node:fs';
import readline from 'node:readline';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { DuckDBInstance } from '@duckdb/node-api';

// Candidate property keys (matched case-insensitively) that are normalized
// into the canonical `name` and `description` search columns.
const NAME_KEYS = ['name', 'title', 'callsign'];
const DESCRIPTION_KEYS = ['description', 'remarks'];
const ICON_KEYS = ['icon'];

/**
 * Return the first non-empty string value from `props` whose key
 * matches (case-insensitively) one of the provided candidate keys.
 */
function pick(
    lookup: Map<string, unknown>,
    candidates: Array<string>,
): string | null {
    for (const candidate of candidates) {
        const value = lookup.get(candidate);
        if (value === undefined || value === null) continue;
        const str = String(value).trim();
        if (str.length) return str;
    }

    return null;
}

/**
 * Build a DuckDB search database from a line-delimited GeoJSON file.
 *
 * The resulting database contains a single `features` table with a normalized
 * schema optimized for text & spatial search:
 *
 *   - name        VARCHAR   Normalized from title/name/callsign
 *   - description VARCHAR   Normalized from description/remarks
 *   - icon        VARCHAR   Feature icon reference (iconset:name)
 *   - geometry    GEOMETRY  Feature geometry (via the spatial extension)
 *
 * Features are streamed and normalized to an intermediate newline-delimited
 * JSON file which DuckDB bulk-loads, keeping memory usage constant regardless
 * of the number of features.
 *
 * @param geojsonldPath Path to the source `.geojsonld` file
 * @param outPath       Path the resulting `.duckdb` file is written to
 * @param tmpdir        Directory used for the intermediate normalized file
 */
export async function buildSearchDatabase(
    geojsonldPath: string,
    outPath: string,
    tmpdir: string,
): Promise<void> {
    const normalizedPath = path.resolve(tmpdir, randomUUID() + '.ndjson');

    const readStream = fs.createReadStream(geojsonldPath);
    const writeStream = fs.createWriteStream(normalizedPath);

    const rl = readline.createInterface({
        input: readStream,
        crlfDelay: Infinity,
    });

    for await (const line of rl) {
        if (!line.trim()) continue;

        let feat;
        try {
            feat = JSON.parse(line);
        } catch {
            continue;
        }

        if (!feat || feat.type !== 'Feature') continue;

        const props = feat.properties && typeof feat.properties === 'object'
            ? feat.properties
            : {};

        const lookup = new Map<string, unknown>();
        for (const key of Object.keys(props)) {
            lookup.set(key.toLowerCase(), props[key]);
        }

        writeStream.write(JSON.stringify({
            name: pick(lookup, NAME_KEYS),
            description: pick(lookup, DESCRIPTION_KEYS),
            icon: pick(lookup, ICON_KEYS),
            geometry: feat.geometry ? JSON.stringify(feat.geometry) : null,
        }) + '\n');
    }

    await new Promise<void>((resolve, reject) => {
        writeStream.end((err?: Error | null) => err ? reject(err) : resolve());
    });

    // Fresh output file - DuckDB refuses to CREATE TABLE over existing data
    if (fs.existsSync(outPath)) fs.rmSync(outPath);

    const instance = await DuckDBInstance.create(outPath);
    const connection = await instance.connect();

    try {
        await connection.run(`INSTALL spatial`);
        await connection.run(`LOAD spatial`);

        await connection.run(`
            CREATE TABLE features AS
            SELECT
                name,
                description,
                icon,
                CASE
                    WHEN geometry IS NULL THEN NULL
                    ELSE ST_GeomFromGeoJSON(geometry)
                END AS geometry
            FROM read_json(
                '${normalizedPath.replace(/'/g, '\'\'')}',
                format = 'newline_delimited',
                columns = {
                    name: 'VARCHAR',
                    description: 'VARCHAR',
                    icon: 'VARCHAR',
                    geometry: 'VARCHAR'
                }
            )
        `);
    } finally {
        connection.closeSync();
        instance.closeSync();
        fs.rmSync(normalizedPath, { force: true });
    }
}
