function up(knex) {
    return knex.schema.raw(`
        ALTER TABLE layers
            ADD COLUMN logging BOOLEAN NOT NULL DEFAULT True;
    `);
}

function down(knex) {
    return knex.schema.raw(``);
}

export {
    up,
    down
}
