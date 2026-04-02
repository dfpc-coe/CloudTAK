-- Custom SQL migration file, put your code below! --
UPDATE basemaps
    SET
        collection = NULL
    WHERE
        collection = '';
