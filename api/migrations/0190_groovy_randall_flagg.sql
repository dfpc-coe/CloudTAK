CREATE TABLE "channel" (
	"bitpos" integer PRIMARY KEY NOT NULL,
	"created" timestamp with time zone DEFAULT Now() NOT NULL,
	"updated" timestamp with time zone DEFAULT Now() NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL
);
