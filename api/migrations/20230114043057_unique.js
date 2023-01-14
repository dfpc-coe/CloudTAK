function up(knex) {
    return knex.schema.raw(`
        CREATE UNIQUE INDEX connections_name_idx
            ON connections(name);
        CREATE UNIQUE INDEX layers_name_idx
            ON layers(name);

        ALTER TABLE layers
            ADD CONSTRAINT unqiue_layers_name
                UNIQUE USING INDEX layers_name_idx;

        ALTER TABLE connections
            ADD CONSTRAINT unqiue_connections_name
                UNIQUE USING INDEX connections_name_idx;
    `);
}

function down(knex) {
    return knex.schema.raw(``);
}

export {
    up,
    down
}
