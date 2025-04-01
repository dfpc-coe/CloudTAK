--> statement-breakpoint
ALTER TABLE "palette" ADD COLUMN "created" timestamp with time zone DEFAULT Now() NOT NULL;--> statement-breakpoint
ALTER TABLE "palette" ADD COLUMN "updated" timestamp with time zone DEFAULT Now() NOT NULL;--> statement-breakpoint
ALTER TABLE "palette_feature" ADD COLUMN "created" timestamp with time zone DEFAULT Now() NOT NULL;--> statement-breakpoint
ALTER TABLE "palette_feature" ADD COLUMN "updated" timestamp with time zone DEFAULT Now() NOT NULL;--> statement-breakpoint
ALTER TABLE "palette_feature" ADD COLUMN "name" text NOT NULL;--> statement-breakpoint
