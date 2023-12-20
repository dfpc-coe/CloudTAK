function up(knex) {
    return knex.schema.raw(`
        DELETE FROM imports;

        ALTER TABLE imports
            ADD COLUMN username TEXT NOT NULL REFERENCES profile (username);
        ALTER TABLE imports
            ADD COLUMN mode TEXT NOT NULL DEFAULT 'Unknown';
        ALTER TABLE imports
            ADD COLUMN config JSON NOT NULL DEFAULT '{}';
    `);
}

function down(knex) {
    return knex.schema.raw(``);
}

export {
    up,
    down
}
