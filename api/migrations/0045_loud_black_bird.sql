-- Custom SQL migration file, put you code below! --


ALTER TABLE layers
    ALTER COLUMN stale
    SET DEFAULT 20;

UPDATE layers
    SET stale = stale / 1000;


