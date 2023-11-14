function up(knex) {
    return knex.schema.raw(`
        CREATE TABLE data_mission (
            id              BIGSERIAL PRIMARY KEY,
            mission         TEXT NOT NULL,
            enabled         BOOLEAN NOT NULL DEFAULT True,
            assets          JSON NOT NULL DEFAULT '[]'::JSON
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
