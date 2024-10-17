UPDATE settings
    SET value = Replace(value, '"', '')
    WHERE Starts_With(key, 'group:');

ALTER TABLE icons
    ADD COLUMN data_alt TEXT;
