export default {
    client: 'postgresql',
    connection: process.env.POSTGRES || 'postgres://postgres@localhost:5432/tak_ps_etl',
    pool: {
        min: 2,
        max: 10
    },
    migrations: {
        tableName: 'knex_migrations',
        stub: 'migrations/migration.stub',
        directory: String(new URL('./migrations', import.meta.url)).replace('file://', '')
    }
};
