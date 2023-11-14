function up(knex) {
    return knex.schema.raw(`
        ALTER TABLE data_mission
            ADD COLUMN data BIGINT NOT NULL
                REFERENCES data(id);
    `);
}

function down(knex) {
    return knex.schema.raw(``);
}

export {
    up,
    down
}
