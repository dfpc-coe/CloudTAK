ALTER TABLE "connection_tokens" ALTER COLUMN "connection" SET DATA TYPE integer;

comment on column data.name is 'Name of Data Sync Package';
comment on column data.description is 'Human readable description of Data Sync package';
comment on column data.auto_transform is 'Should CloudTAK enhanced data products be created';
comment on column data.connection is 'ConnectionID this Data Sync is a child of';
comment on column data.mission_sync is 'Is the DataSync actively syncing with TAK Server';
comment on column data.assets is 'Select only given assets to sync with TAK Server - Defaults to ["**"] glob of all files';
