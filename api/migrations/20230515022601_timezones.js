function up(knex) {
    return knex.schema.raw(`
        ALTER TABLE basemaps
            ALTER COLUMN created TYPE timestamptz
                USING created::timestamptz;
        ALTER TABLE basemaps
            ALTER COLUMN updated TYPE timestamptz
                USING updated::timestamptz;
        ALTER TABLE connections
            ALTER COLUMN created TYPE timestamptz
                USING created::timestamptz;
        ALTER TABLE connections
            ALTER COLUMN updated TYPE timestamptz
                USING updated::timestamptz;
        ALTER TABLE data
            ALTER COLUMN created TYPE timestamptz
                USING created::timestamptz;
        ALTER TABLE data
            ALTER COLUMN updated TYPE timestamptz
                USING updated::timestamptz;
        ALTER TABLE layer_alerts
            ALTER COLUMN created TYPE timestamptz
                USING created::timestamptz;
        ALTER TABLE layer_alerts
            ALTER COLUMN updated TYPE timestamptz
                USING updated::timestamptz;
        ALTER TABLE layers
            ALTER COLUMN created TYPE timestamptz
                USING created::timestamptz;
        ALTER TABLE layers
            ALTER COLUMN updated TYPE timestamptz
                USING updated::timestamptz;
        ALTER TABLE server
            ALTER COLUMN created TYPE timestamptz
                USING created::timestamptz;
        ALTER TABLE server
            ALTER COLUMN updated TYPE timestamptz
                USING updated::timestamptz;
    `);
}

function down(knex) {
    return knex.schema.raw(``);
}

export {
    up,
    down
}
