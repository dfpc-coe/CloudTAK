function up(knex) {
    return knex.schema.raw(`
        ALTER TABLE layers
            ADD COLUMN stale INT DEFAULT 20000;
        ALTER TABLE layers
            ADD COLUMN task TEXT;
        ALTER TABLE layers
            ADD COLUMN connection BIGINT REFERENCES connections(id);
        ALTER TABLE layers
            ADD COLUMN cron TEXT;
        ALTER TABLE layers
            ADD COLUMN environment JSONB DEFAULT '{}'::JSONB;
        ALTER TABLE layers
            ADD COLUMN memory INT DEFAULT 128;
        ALTER TABLE layers
            ADD COLUMN timeout INT DEFAULT 128;

        UPDATE layers
            SET
                stale = layers_live.stale,
                task = layers_live.task,
                connection = layers_live.connection,
                cron = layers_live.cron,
                environment = layers_live.environment,
                memory = layers_live.memory,
                timeout = layers_live.timeout
            FROM
                layers_live
            WHERE
                layers.id = layers_live.layer_id;

        ALTER TABLE layers
            ALTER COLUMN stale SET NOT NULL;
        ALTER TABLE layers
            ALTER COLUMN task SET NOT NULL;
        ALTER TABLE layers
            ALTER COLUMN connection SET NOT NULL;
        ALTER TABLE layers
            ALTER COLUMN cron SET NOT NULL;
        ALTER TABLE layers
            ALTER COLUMN environment SET NOT NULL;
        ALTER TABLE layers
            ALTER COLUMN memory SET NOT NULL;
        ALTER TABLE layers
            ALTER COLUMN timeout SET NOT NULL;

        DROP TABLE
            layers_live;

        DROP TABLE
            layers_file;

        ALTER TABLE layers
            DROP COLUMN mode;
    `);
}

function down(knex) {
    return knex.schema.raw(``);
}

export {
    up,
    down
}
