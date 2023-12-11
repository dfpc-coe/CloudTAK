function up(knex) {
    return knex.schema.raw(`
        DELETE FROM profile;
    `);
}

function down(knex) {
    return knex.schema.raw(``);
}

export {
    up,
    down
}
