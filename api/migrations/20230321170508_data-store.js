function up(knex) {
    return knex.schema.raw(`
        CREATE TABLE data (
            id          BIGSERIAL PRIMARY KEY,
            created     TIMESTAMP NOT NULL DEFAULT NOW(),
            updated     TIMESTAMP NOT NULL DEFAULT NOW(),
            name        TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT ''
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
