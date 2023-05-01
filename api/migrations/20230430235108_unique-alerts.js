function up(knex) {
    return knex.schema.raw(`
        DELETE FROM layer_alerts;
        CREATE UNIQUE INDEX layer_alerts_unique
            ON layer_alerts(layer, title);
    `);
}

function down(knex) {
    return knex.schema.raw(``);
}

export {
    up,
    down
}
