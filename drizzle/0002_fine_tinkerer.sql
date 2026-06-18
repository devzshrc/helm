CREATE TABLE "chat_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"role" text NOT NULL,
	"content" text,
	"tool_calls" jsonb,
	"action_status" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"title" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_meta" (
	"tenant_id" text NOT NULL,
	"gmail_id" text NOT NULL,
	"thread_id" text NOT NULL,
	"priority" text,
	"snoozed_until" timestamp with time zone,
	"from_addr" text,
	"subject" text,
	"snippet" text,
	"received_at" timestamp with time zone,
	"embedding" vector(1536),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_meta_tenant_id_gmail_id_pk" PRIMARY KEY("tenant_id","gmail_id")
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"tenant_id" text PRIMARY KEY NOT NULL,
	"shortcuts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"focus_threshold" text DEFAULT 'Important' NOT NULL,
	"triage_prefs" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text,
	"plugin" text,
	"action" text,
	"raw" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_session_id_chat_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_messages_session_idx" ON "chat_messages" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "email_meta_tenant_thread_idx" ON "email_meta" USING btree ("tenant_id","thread_id");--> statement-breakpoint
CREATE INDEX "email_meta_tenant_priority_idx" ON "email_meta" USING btree ("tenant_id","priority");