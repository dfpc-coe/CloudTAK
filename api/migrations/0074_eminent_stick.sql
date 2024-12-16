-- Custom SQL migration file, put your code below! --
UPDATE profile_overlays
    SET
        url = Regexp_Replace(url, '^http(s)?://[a-zA-Z.]*/', '/')
    WHERE
        url ~ '/profile/';
