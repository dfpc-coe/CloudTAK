function up(knex) {
    return knex.schema.raw(`
        ALTER TABLE profile
            ADD COLUMN tak_loc GEOMETRY(Point, 4326);
    `);
}

function down(knex) {
    return knex.schema.raw(``);
}

export {
    up,
    down
}
