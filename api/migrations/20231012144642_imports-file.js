function up(knex) {
    return knex.schema.raw(`
        DELETE FROM imports;

        ALTER TABLE imports
            ADD COLUMN name TEXT NOT NULL;
    `);
}

function down(knex) {
    return knex.schema.raw(``);
}

export {
    up,
    down
}
