function up(knex) {
    return knex.schema.raw(`
        ALTER TABLE icons
            ADD COLUMN data TEXT NOT NULL;
    `);
}

function down(knex) {
    return knex.schema.raw(``);
}

export {
    up,
    down
}
