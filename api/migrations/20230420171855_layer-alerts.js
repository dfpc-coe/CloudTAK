function up(knex) {
    return knex.schema.raw(`
        CREATE TABLE layer_alerts (
            id          BIGSERIAL PRIMARY KEY,
            created     TIMESTAMP NOT NULL DEFAULT Now(),
            updated     TIMESTAMP NOT NULL DEFAULT Now(),
            layer       BIGINT NOT NULL REFERENCES layers(id),
            icon        TEXT NOT NULL DEFAULT 'alert-circle',
            priority    TEXT NOT NULL DEFAULT 'yellow',
            title       TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT 'Details Unknown',
            hidden      BOOLEAN NOT NULL DEFAULT False
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
