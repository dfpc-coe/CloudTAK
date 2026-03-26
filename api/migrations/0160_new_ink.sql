-- Custom SQL migration file, put your code below! --
UPDATE iconsets
    SET
        spritesheet_json = NULL,
        spritesheet_data = NULL;
