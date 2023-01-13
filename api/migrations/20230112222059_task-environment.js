function up(knex) {
    return knex.schema.raw(`
        ALTER TABLE layers_live
            ADD COLUMN environment JSONB NOT NULL DEFAULT '{}'::JSONB
    `);
}

function down(knex) {
    return knex.schema.raw(``);
}

export {
    up,
    down
}
