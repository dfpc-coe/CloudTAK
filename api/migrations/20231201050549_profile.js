function up(knex) {
    return knex.schema.raw(`
        CREATE TABLE profile (
            username    TEXT NOT NULL PRIMARY KEY,
            auth        JSON NOT NULL DEFAULT '{}'::JSON,
            created     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated     TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
