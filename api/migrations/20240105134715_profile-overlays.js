function up(knex) {
    return knex.schema.raw(`
        CREATE TABLE profile_overlays (
            id          BIGSERIAL PRIMARY KEY,
            username    TEXT REFERENCES profile(username),
            created     TIMESTAMPTZ NOT NULL DEFAULT Now(),
            updated     TIMESTAMPTZ NOT NULL DEFAULT Now(),
            pos         BIGINT NOT NULL DEFAULT 5,
            type        TEXT NOT NULL DEFAULT 'vector',
            opacity     FLOAT NOT NULL DEFAULT 1,
            visible     BOOLEAN NOT NULL DEFAULT True,
            mode        TEXT NOT NULL,
            mode_id     BIGINT NOT NULL,
            url         TEXT NOT NULL
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
