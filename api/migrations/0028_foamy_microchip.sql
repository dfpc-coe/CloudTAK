DELETE FROM profile_chats;
ALTER TABLE profile_chats DROP COLUMN username;
ALTER TABLE profile_chats ADD COLUMN username TEXT NOT NULL REFERENCES profile(username);
ALTER TABLE profile_chats ADD COLUMN id SERIAL PRIMARY KEY;
