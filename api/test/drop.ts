import postgres from 'postgres'

export default async function drop(connstr: string) {
    const client = postgres(connstr, {
        onnotice: () => {}
    });

    const pgres = await client`
        SELECT
            'drop table "' || tablename || '" cascade;' AS drop
        FROM
            pg_tables
        WHERE
            schemaname = 'public'
            AND tablename != 'spatial_ref_sys'
    `;

    await client`DROP SCHEMA IF EXISTS drizzle CASCADE`;
    for (const r of pgres) {
        await client.unsafe(r.drop);
    }

    client.end();
}
