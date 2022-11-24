function up(knex) {
    return knex.schema.raw(`
        CREATE TABLE layers (
            id      BIGINT serial PRIMARY KEY,
            name    TEXT NOT NULL
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
