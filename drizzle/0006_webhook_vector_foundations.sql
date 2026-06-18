CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
ALTER TABLE "webhook_events" ADD COLUMN IF NOT EXISTS "status" text;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "webhook_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"plugin" text NOT NULL,
	"channel_id" text,
	"resource_id" text,
	"external_account_id" text,
	"status" text DEFAULT 'unknown' NOT NULL,
	"expires_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhook_subscriptions_tenant_idx" ON "webhook_subscriptions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhook_subscriptions_channel_idx" ON "webhook_subscriptions" USING btree ("plugin","channel_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhook_subscriptions_external_idx" ON "webhook_subscriptions" USING btree ("plugin","external_account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_meta_embedding_hnsw_idx" ON "email_meta" USING hnsw ("embedding" vector_cosine_ops);
