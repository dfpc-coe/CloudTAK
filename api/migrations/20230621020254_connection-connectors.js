function up(knex) {
    return knex.schema.raw(`
        CREATE TABLE connection_sinks (
            id          BIGSERIAL PRIMARY KEY,
            created     TIMESTAMP NOT NULL DEFAULT Now(),
            updated     TIMESTAMP NOT NULL DEFAULT Now(),
            connection  BIGINT NOT NULL REFERENCES connections(id),
            type        TEXT NOT NULL,
            body        JSON NOT NULL DEFAULT '{}'::JSON
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
