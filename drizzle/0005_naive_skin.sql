CREATE TABLE "agent_activity_log" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"negotiation_id" text,
	"event_type" text NOT NULL,
	"description" text NOT NULL,
	"link_thread_id" text,
	"link_event_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduling_negotiations" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"thread_id" text NOT NULL,
	"counterparty_email" text,
	"counterparty_name" text,
	"subject" text,
	"status" text NOT NULL,
	"intent" text,
	"proposed_slots" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"chosen_slot" jsonb,
	"draft_reply" text,
	"event_id" text,
	"proposal_group_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "timezone" text DEFAULT 'UTC' NOT NULL;--> statement-breakpoint
CREATE INDEX "activity_tenant_idx" ON "agent_activity_log" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "negotiations_tenant_idx" ON "scheduling_negotiations" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "negotiations_thread_idx" ON "scheduling_negotiations" USING btree ("thread_id");