function up(knex) {
    return knex.schema.raw(`
        ALTER TABLE imports
            ADD COLUMN mode_id TEXT;
    `);
}

function down(knex) {
    return knex.schema.raw(``);
}

export {
    up,
    down
}
