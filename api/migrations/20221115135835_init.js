function up(knex) {
    return knex.schema.raw(`
        CREATE TABLE layers (
            id                  BIGSERIAL PRIMARY KEY,
            name                TEXT NOT NULL,
            description         TEXT NOT NULL DEFAULT '',
            cron                TEXT NOT NULL,
            enabled             BOOLEAN NOT NULL DEFAULT True
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
