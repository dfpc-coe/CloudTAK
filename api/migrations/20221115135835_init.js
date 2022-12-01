function up(knex) {
    return knex.schema.raw(`
        CREATE TABLE layers (
            id                  BIGSERIAL PRIMARY KEY,
            name                TEXT NOT NULL,
            created             TIMESTAMP NOT NULL DEFAULT Now(),
            updated             TIMESTAMP NOT NULL DEFAULT Now(),
            description         TEXT NOT NULL DEFAULT '',
            cron                TEXT NOT NULL,
            enabled             BOOLEAN NOT NULL DEFAULT True,
            connection          BIGINT NOT NULL REFERENCES connections(id),
            stale               INT NOT NULL DEFAULT 20000
        );

        CREATE TABLE connections (
            id                  BIGSERIAL PRIMARY KEY,
            created             TIMESTAMP NOT NULL DEFAULT Now(),
            updated             TIMESTAMP NOT NULL DEFAULT Now(),
            name                TEXT NOT NULL,
            description         TEXT NOT NULL DEFAULT '',
            enabled             BOOLEAN NOT NULL DEFAULT True,
            auth                JSON NOT NULL
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
