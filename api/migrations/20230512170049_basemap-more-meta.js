function up(knex) {
    return knex.schema.raw(`
        CREATE EXTENSION postgis;

        ALTER TABLE basemaps
            ADD COLUMN bounds GEOMETRY(POLYGON, 4326);
        ALTER TABLE basemaps
            ADD COLUMN center GEOMETRY(POINT, 4326);
        ALTER TABLE basemaps
            ADD COLUMN minzoom INT NOT NULL DEFAULT 0;
        ALTER TABLE basemaps
            ADD COLUMN maxzoom INT NOT NULL DEFAULT 16;
        ALTER TABLE basemaps
            ADD COLUMN format TEXT NOT NULL DEFAULT 'png';
    `);
}

function down(knex) {
    return knex.schema.raw(``);
}

export {
    up,
    down
}
