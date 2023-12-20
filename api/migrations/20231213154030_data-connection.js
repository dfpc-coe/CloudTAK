function up(knex) {
    return knex.schema.raw(`
        ALTER TABLE data
            ADD COLUMN connection BIGINT REFERENCES connections(id);
        UPDATE data
            SET connection = 1;
        ALTER TABLE data
            ALTER COLUMN connection SET NOT NULL;

    `);
}

function down(knex) {
    return knex.schema.raw(`
    `);
}

export {
    up,
    down
}
