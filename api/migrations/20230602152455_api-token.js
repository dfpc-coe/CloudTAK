function up(knex) {
    return knex.schema.raw(`
        CREATE TABLE IF NOT EXISTS tokens (
            id          BIGSERIAL,
            email       TEXT NOT NULL,
            name        TEXT NOT NULL,
            token       TEXT PRIMARY KEY,
            created     TIMESTAMPTZ NOT NULL DEFAULT Now(),
            updated     TIMESTAMPTZ NOT NULL DEFAULT Now()
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
