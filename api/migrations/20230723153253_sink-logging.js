function up(knex) {
    return knex.schema.raw(`
        ALTER TABLE connection_sinks
            ADD COLUMN logging BOOLEAN NOT NULL DEFAULT False;
    `);
}

function down(knex) {
    return knex.schema.raw(``);
}

export {
    up,
    down
}
