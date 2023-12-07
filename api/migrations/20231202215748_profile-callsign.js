function up(knex) {
    return knex.schema.raw(`
        ALTER TABLE profile
            ADD COLUMN tak_callsign TEXT NOT NULL DEFAULT 'CloudTAK User';
        ALTER TABLE profile
            ADD COLUMN tak_group TEXT NOT NULL DEFAULT 'Orange';
        ALTER TABLE profile
            ADD COLUMN tak_role TEXT NOT NULL DEFAULT 'Team Member';
    `);
}

function down(knex) {
    return knex.schema.raw(``);
}

export {
    up,
    down
}
