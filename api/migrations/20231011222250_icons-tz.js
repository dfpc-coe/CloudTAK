function up(knex) {
    return knex.schema.raw(`
        ALTER TABLE icons
            ADD COLUMN created TIMESTAMPTZ NOT NULL DEFAULT Now();
        ALTER TABLE icons
            ADD COLUMN updated TIMESTAMPTZ NOT NULL DEFAULT Now();
        ALTER TABLE iconsets
            DROP COLUMN created;
        ALTER TABLE iconsets
            DROP COLUMN updated;
        ALTER TABLE iconsets
            ADD COLUMN created TIMESTAMPTZ NOT NULL DEFAULT Now();
        ALTER TABLE iconsets
            ADD COLUMN updated TIMESTAMPTZ NOT NULL DEFAULT Now();
    `);
}

function down(knex) {
    return knex.schema.raw(``);
}

export {
    up,
    down
}
