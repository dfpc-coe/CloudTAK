function up(knex) {
    return knex.schema.raw(`
        DROP TABLE assets;
    `);
}

function down(knex) {
    return knex.schema.raw(``);
}

export {
    up,
    down
}
