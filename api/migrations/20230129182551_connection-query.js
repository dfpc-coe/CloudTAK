function up(knex) {
    return knex.schema.raw(`
        CREATE TABLE connections_query (
            id          BIGINT PRIMARY KEY,
            conn_id     BIGINT REFERENCES connections(id),
            created     TIMESTAMP NOT NULL DEFAULT Now(),
            updated     TIMESTAMP NOT NULL DEFAULT Now(),
            query       TEXT NOT NULL,
            notify      JSON[]
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
