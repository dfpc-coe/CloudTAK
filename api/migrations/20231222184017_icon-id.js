function up(knex) {
    return knex.schema.raw(`
        ALTER TABLE icons
            ADD COLUMN id BIGSERIAL PRIMARY KEY;
    `);
}

function down(knex) {
    return knex.schema.raw(``);
}

export {
    up,
    down
}
