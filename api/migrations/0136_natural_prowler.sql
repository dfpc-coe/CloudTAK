-- Custom SQL migration file, put your code below! --

UPDATE icons
    SET data = 'data:image/png;base64,' || data
