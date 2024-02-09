DELETE FROM profile_overlays;
ALTER TABLE "profile_overlays"
    ADD CONSTRAINT "profile_overlays_username_url_unique"
    UNIQUE("username","url");
