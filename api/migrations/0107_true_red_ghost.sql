ALTER TABLE "profile_features" ADD PRIMARY KEY ("id");--> statement-breakpoint
ALTER TABLE "layers_outgoing" ADD COLUMN "filters" json DEFAULT '{}'::json NOT NULL;