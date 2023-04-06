function up(knex) {
    return knex.schema.raw(`
        CREATE TABLE total (
            dt      DATE PRIMARY KEY DEFAULT NOW(),
            count   BIGINT NOT NULL
        );

        CREATE TABLE fields (
            dt      DATE DEFAULT NOW(),
            dim     TEXT NOT NULL,
            stats   JSONB NOT NULL,

            PRIMARY KEY (dt, dim)
        );
    `);
}

function down(knex) {
    return knex.schema.raw(``);
}

export {
    up,
    down
}
