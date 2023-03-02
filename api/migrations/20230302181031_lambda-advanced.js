function up(knex) {
    return knex.schema.raw(`
        ALTER TABLE layers_live
            ADD COLUMN memory INT NOT NULL DEFAULT 128;
        ALTER TABLE layers_live
            ADD COLUMN timeout INT NOT NULL DEFAULT 60;
    `);
}

function down(knex) {
    return knex.schema.raw(``);
}

export {
    up,
    down
}
