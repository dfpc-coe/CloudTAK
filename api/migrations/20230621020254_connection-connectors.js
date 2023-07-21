function up(knex) {
    return knex.schema.raw(`
        CREATE TABLE connection_sinks (
            id          BIGSERIAL PRIMARY KEY,
            created     TIMESTAMP NOT NULL DEFAULT Now(),
            updated     TIMESTAMP NOT NULL DEFAULT Now(),
            enabled     BOOLEAN NOT NULL DEFAULT True,
            connection  BIGINT NOT NULL REFERENCES connections(id),
            name        TEXT NOT NULL,
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
