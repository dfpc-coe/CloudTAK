ALTER TABLE "profile_features" DROP CONSTRAINT "profile_features_pkey";--> statement-breakpoint
ALTER TABLE "profile_features" ADD COLUMN "deleted" BOOLEAN NOT NULL DEFAULT False;--> statement-breakpoint
ALTER TABLE "profile_features" ADD CONSTRAINT "profile_features_username_id_pk" PRIMARY KEY("username","id");
