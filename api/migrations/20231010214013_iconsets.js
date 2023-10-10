function up(knex) {
    return knex.schema.raw(`
        CREATE TABLE iconsets (
            uid                 TEXT NOT NULL PRIMARY KEY,
            version             INT NOT NULL,
            name                TEXT NOT NULL,
            default_group       TEXT,
            default_friendly    TEXT,
            default_hostile     TEXT,
            default_neutral     TEXT,
            default_unknown     TEXT,
            skip_resize         BOOLEAN NOT NULL DEFAULT False
        );

        CREATE TABLE icon (
            iconset         TEXT NOT NULL REFERENCES iconsets(uid),
            name            TEXT NOT NULL,
            type2525b       TEXT
        );
    `);
}

function down(knex) {
    return knex.schema.raw(``);
}

export {
    up,
    down
}
