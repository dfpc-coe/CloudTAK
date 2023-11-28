function up(knex) {
    return knex.schema.raw(`
        ALTER TABLE data
            ADD COLUMN auto_transform BOOLEAN NOT NULL DEFAULT False;
    `);
}

function down(knex) {
    return knex.schema.raw(``);
}

export {
    up,
    down
}
