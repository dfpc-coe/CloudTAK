function up(knex) {
    return knex.schema.raw(`
        ALTER TABLE iconsets
            ADD COLUMN created TIMESTAMPTZ;
        ALTER TABLE iconsets
            ADD COLUMN updated TIMESTAMPTZ;
    `);
}

function down(knex) {
    return knex.schema.raw(``);
}

export {
    up,
    down
}
