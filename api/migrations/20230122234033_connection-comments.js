function up(knex) {
    return knex.schema.raw(`
        COMMENT ON COLUMN
            connections.id IS 'Unique Connection ID';
        COMMENT ON COLUMN
            connections.created IS 'Creation TimeStamp';
        COMMENT ON COLUMN
            connections.updated IS 'Updated TimeStamp';
        COMMENT ON COLUMN
            connections.name IS 'Unique human readable name of the connection';
        COMMENT ON COLUMN
            connections.description IS 'Human readable description of the connection';
        COMMENT ON COLUMN
            connections.enabled IS 'Is the connection passing CoT messages from layers into the Connection';
        COMMENT ON COLUMN
            connections.auth IS 'Authentication settings for the connection';
    `);
}

function down(knex) {
    return knex.schema.raw(``);
}

export {
    up,
    down
}
