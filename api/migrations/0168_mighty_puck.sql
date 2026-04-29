-- Custom SQL migration file, put your code below! --

UPDATE icons
    SET name = REGEXP_REPLACE(SUBSTRING(path FROM '/(.*)'), '\.[^.]+$', '');

