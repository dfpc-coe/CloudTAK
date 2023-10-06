function up(knex) {
    return knex.schema.raw(`
        DROP TABLE fields;
        DROP TABLE total;
    `);
}

function down(knex) {
    return knex.schema.raw(``);
}

export {
    up,
    down
}
