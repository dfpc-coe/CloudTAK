ALTER TABLE "layers_outgoing" ADD COLUMN IF NOT EXISTS "subscriptions" text[] DEFAULT '{}' NOT NULL;
--> statement-breakpoint
UPDATE "layers_outgoing" SET "subscriptions" = '{feature:*}' WHERE "subscriptions" = '{}';
