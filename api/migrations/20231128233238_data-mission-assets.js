function up(knex) {
    return knex.schema.raw(`
        ALTER TABLE data_mission
            DROP COLUMN assets;

        ALTER TABLE data_mission
            ADD COLUMN assets JSON NOT NULL DEFAULT '["*"]'::json;
    `);
}

function down(knex) {
    return knex.schema.raw(``);
}

export {
    up,
    down
}
