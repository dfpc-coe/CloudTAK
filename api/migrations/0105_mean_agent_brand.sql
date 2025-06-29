-- Custom SQL migration file, put your code below! --
ALTER TABLE layers DROP CONSTRAINT IF EXISTS unqiue_layers_name;
