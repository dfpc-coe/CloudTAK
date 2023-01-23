function up(knex) {
    return knex.schema.raw(`
        COMMENT ON COLUMN
            layers.id IS 'Unique Layer ID';
        COMMENT ON COLUMN
            layers.created IS 'Creation TimeStamp';
        COMMENT ON COLUMN
            layers.updated IS 'Updated TimeStamp';
        COMMENT ON COLUMN
            layers.name IS 'Unique human readable name';
        COMMENT ON COLUMN
            layers.description IS 'Human readable description';
        COMMENT ON COLUMN
            layers.enabled IS 'Is the layer passing CoT messages';
        COMMENT ON COLUMN
            layers.enabled_styles IS 'Is styling enabled for the layer';
        COMMENT ON COLUMN
            layers.styles IS 'Styling rules for the layer';
    `);
}

function down(knex) {
    return knex.schema.raw(``);
}

export {
    up,
    down
}
