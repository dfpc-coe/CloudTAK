import postgres from 'postgres'

export default async function drop() {
    const client = postgres(process.env.POSTGRES || 'postgres://postgres@localhost:5432/tak_ps_etl')

    const pgres = await client`
        SELECT
            'drop table "' || tablename || '" cascade;' AS drop
        FROM
            pg_tables
        WHERE
            schemaname = 'public'
            AND tablename != 'spatial_ref_sys'
    `;

    for (const r of pgres) {
        await client`r.drop`;
    }

    client.end();
}
