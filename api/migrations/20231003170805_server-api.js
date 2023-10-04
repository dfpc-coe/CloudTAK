function up(knex) {
    return knex.schema.raw(`
        ALTER TABLE server
            ADD COLUMN api TEXT NOT NULL DEFAULT '';
    `);
}

function down(knex) {
    return knex.schema.raw(``);
}

export {
    up,
    down
}
