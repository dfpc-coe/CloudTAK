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
            name                TEXT NOT NULL,
            created             TIMESTAMP NOT NULL DEFAULT Now(),
            updated             TIMESTAMP NOT NULL DEFAULT Now(),
            description         TEXT NOT NULL DEFAULT '',
            enabled             BOOLEAN NOT NULL DEFAULT True,
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

        CREATE VIEW view_layers AS
            SELECT
                layers.*,
                layers_live.stale,
                layers_live.task,
                layers_live.connection,
                layers_live.cron,
                layers_file.asset_id
            FROM
                layers
                    LEFT JOIN layers_live
                        ON layers.id = layers_live.layer_id
                    LEFT JOIN layers_file
                        ON layers.id = layers_file.layer_id

    `);
}

function down(knex) {
    return knex.schema.raw(``);
}

export {
    up,
    down
}
