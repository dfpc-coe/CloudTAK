function up(knex) {
    return knex.schema.raw(`
        CREATE TABLE imports (
            id          TEXT PRIMARY KEY,
            created     TIMESTAMP NOT NULL DEFAULT Now(),
            updated     TIMESTAMP NOT NULL DEFAULT Now(),
            status      TEXT NOT NULL DEFAULT 'Pending',
            error       TEXT,
            result      JSON NOT NULL DEFAULT '{}'::JSON
        )
    `);
}

function down(knex) {
    return knex.schema.raw(``);
}

export {
    up,
    down
}
