function up(knex) {
    return knex.schema.raw(`
        ALTER TABLE layers
            ADD COLUMN schema JSONB NOT NULL DEFAULT '{"type": "object", "additionalProperties": true, "required": [], "properties": {} }'::jsonb
    `);
}

function down(knex) {
    return knex.schema.raw(``);
}

export {
    up,
    down
}
