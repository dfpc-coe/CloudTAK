function up(knex) {
    return knex.schema.raw(`
        ALTER TABLE icons   
            ADD COLUMN path TEXT NOT NULL;
    `);
}

function down(knex) {
    return knex.schema.raw(``);
}

export {
    up,
    down
}
