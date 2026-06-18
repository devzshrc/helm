CREATE TABLE "calendar_events" (
	"tenant_id" text NOT NULL,
	"event_id" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"start" text,
	"end" text,
	"all_day" boolean DEFAULT false NOT NULL,
	"location" text,
	"description" text,
	"attendees" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"html_link" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "calendar_events_tenant_id_event_id_pk" PRIMARY KEY("tenant_id","event_id")
);
--> statement-breakpoint
CREATE TABLE "email_bodies" (
	"tenant_id" text NOT NULL,
	"gmail_id" text NOT NULL,
	"html" text NOT NULL,
	"cached_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_bodies_tenant_id_gmail_id_pk" PRIMARY KEY("tenant_id","gmail_id")
);
--> statement-breakpoint
CREATE TABLE "webhook_subscriptions" (
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
ALTER TABLE "email_meta" ALTER COLUMN "embedding" SET DATA TYPE vector(768);--> statement-breakpoint
ALTER TABLE "webhook_events" ADD COLUMN "status" text;--> statement-breakpoint
CREATE INDEX "cal_events_tenant_start_idx" ON "calendar_events" USING btree ("tenant_id","start");--> statement-breakpoint
CREATE INDEX "webhook_subscriptions_tenant_idx" ON "webhook_subscriptions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "webhook_subscriptions_channel_idx" ON "webhook_subscriptions" USING btree ("plugin","channel_id");--> statement-breakpoint
CREATE INDEX "webhook_subscriptions_external_idx" ON "webhook_subscriptions" USING btree ("plugin","external_account_id");--> statement-breakpoint
CREATE INDEX "webhook_events_tenant_created_idx" ON "webhook_events" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "workflows_enabled_idx" ON "workflows" USING btree ("enabled");