function up(knex) {
    return knex.schema.raw(`
        ALTER TABLE basemaps
            ADD COLUMN type TEXT NOT NULL DEFAULT 'raster'
    `);
}

function down(knex) {
    return knex.schema.raw(``);
}

export {
    up,
    down
}
