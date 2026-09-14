import fs from 'node:fs';
import crypto from 'node:crypto';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import drop from './drop.js';

// Arbitrary advisory lock key shared by every test worker on the cluster
const LOCK_ID = 727282;

const migrations = new URL('../migrations/', import.meta.url);

let worker: { name: string; connstr: string } | undefined;

export function baseConnstr(): string {
    return process.env.POSTGRES || 'postgres://postgres@localhost:5432/tak_ps_etl_test';
}

function withDatabase(connstr: string, database: string): string {
    const url = new URL(connstr);
    url.pathname = `/${database}`;
    return url.toString();
}

/**
 * Templates are keyed by the migration set they were built from so a
 * branch switch that changes migrations transparently rebuilds them
 */
function migrationsHash(): string {
    const hash = crypto.createHash('sha1');
    for (const file of fs.readdirSync(migrations).sort()) {
        if (!file.endsWith('.sql')) continue;
        hash.update(file);
        hash.update(fs.readFileSync(new URL(file, migrations)));
    }
    return hash.digest('hex').slice(0, 8);
}

function alive(pid: number): boolean {
    try {
        process.kill(pid, 0);
        return true;
    } catch (err) {
        return (err as NodeJS.ErrnoException).code === 'EPERM';
    }
}

/**
 * Return a connection string for a database private to this process
 *
 * Test files run in parallel processes, so each one gets its own copy of a
 * fully migrated template database - cloning a template is far cheaper than
 * running the migrations and lets files share a single Postgres cluster
 * without interfering with each other
 *
 * @param [opts.reset=true] Truncate all tables if the database already exists
 */
export async function testDatabase(opts: { reset?: boolean } = {}): Promise<string> {
    if (worker) {
        if (opts.reset !== false) await drop(worker.connstr);
        return worker.connstr;
    }

    const base = baseConnstr();
    const baseName = new URL(base).pathname.slice(1);
    const template = `${baseName}_tpl_${migrationsHash()}`;
    const name = `${baseName}_w${process.pid}`;

    // A single session holds the advisory lock for the duration of the
    // provisioning and releases it implicitly when it ends
    const client = postgres(base, { max: 1, onnotice: () => {} });

    try {
        await client`SELECT pg_advisory_lock(${LOCK_ID})`;

        const exists = await client`SELECT 1 FROM pg_database WHERE datname = ${template}`;

        if (!exists.length) {
            const stale = await client`SELECT datname FROM pg_database WHERE datname LIKE ${baseName + '_tpl_%'}`;
            for (const row of stale) {
                await client.unsafe(`DROP DATABASE "${row.datname}" WITH (FORCE)`);
            }

            await client.unsafe(`CREATE DATABASE "${template}"`);

            // CREATE DATABASE ... TEMPLATE fails while anything is connected
            // to the template, so the migration session must be fully closed
            const sql = postgres(withDatabase(base, template), { max: 1, onnotice: () => {} });
            try {
                await migrate(drizzle(sql), { migrationsFolder: migrations.pathname });
            } finally {
                await sql.end();
            }
        }

        const orphans = await client`SELECT datname FROM pg_database WHERE datname LIKE ${baseName + '_w%'}`;
        for (const row of orphans) {
            const pid = Number(row.datname.slice(baseName.length + 2));
            if (Number.isInteger(pid) && pid !== process.pid && alive(pid)) continue;
            await client.unsafe(`DROP DATABASE "${row.datname}" WITH (FORCE)`);
        }

        await client.unsafe(`CREATE DATABASE "${name}" TEMPLATE "${template}"`);
    } finally {
        await client.end();
    }

    // Every parallel worker shares one Postgres cluster, so keep each pool
    // small enough that a full run stays under the default max_connections
    const connstr = new URL(withDatabase(base, name));
    connstr.searchParams.set('max', '2');

    worker = { name, connstr: connstr.toString() };

    return worker.connstr;
}

/**
 * Drop this process's database - all remaining connections are terminated
 */
export async function dropTestDatabase(): Promise<void> {
    if (!worker) return;

    const client = postgres(baseConnstr(), { max: 1, onnotice: () => {} });

    try {
        await client.unsafe(`DROP DATABASE IF EXISTS "${worker.name}" WITH (FORCE)`);
    } finally {
        await client.end();
    }

    worker = undefined;
}
