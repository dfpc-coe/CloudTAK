function up(knex) {
    return knex.schema.raw(`
        ALTER TABLE layers
            ADD COLUMN data BIGINT REFERENCES data(id);
        ALTER TABLE layers
            ALTER COLUMN connection DROP NOT NULL;
    `);
}

function down(knex) {
    return knex.schema.raw(``);
}

export {
    up,
    down
}
