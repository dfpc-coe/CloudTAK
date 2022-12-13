function up(knex) {
    return knex.schema.raw(`
        CREATE TABLE assets (
            id          BIGSERIAL PRIMARY KEY,
            created     TIMESTAMP NOT NULL DEFAULT Now(),
            updated     TIMESTAMP NOT NULL DEFAULT Now(),
            name        TEXT NOT NULL,
            storage     BOOLEAN NOT NULL DEFAULT False
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

        CREATE TABLE layers (
            id                  BIGSERIAL PRIMARY KEY,
            mode                TEXT NOT NULL,
            name                TEXT NOT NULL,
            created             TIMESTAMP NOT NULL DEFAULT Now(),
            updated             TIMESTAMP NOT NULL DEFAULT Now(),
            description         TEXT NOT NULL DEFAULT '',
            enabled             BOOLEAN NOT NULL DEFAULT True,
            enabled_styles      BOOLEAN NOT NULL DEFAULT False,
            styles              JSONB NOT NULL Default '{}'::JSONB
        );

        CREATE TABLE layers_live (
            layer_id            BIGINT PRIMARY KEY REFERENCES layers(id),
            stale               INT NOT NULL DEFAULT 20000,
            task                TEXT NOT NULL,
            connection          BIGINT NOT NULL REFERENCES connections(id),
            cron                TEXT NOT NULL
        );

        CREATE TABLE layers_file (
            layer_id            BIGINT PRIMARY KEY REFERENCES layers(id),
            asset_id            BIGINT NOT NULL REFERENCES assets(id)
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
