CREATE TABLE IF NOT EXISTS "email_bodies" (
  "tenant_id" text NOT NULL,
  "gmail_id"  text NOT NULL,
  "html"      text NOT NULL,
  "cached_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("tenant_id", "gmail_id")
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "calendar_events" (
  "tenant_id"   text NOT NULL,
  "event_id"    text NOT NULL,
  "title"       text NOT NULL DEFAULT '',
  "start"       text,
  "end"         text,
  "all_day"     boolean NOT NULL DEFAULT false,
  "location"    text,
  "description" text,
  "attendees"   jsonb NOT NULL DEFAULT '[]',
  "html_link"   text,
  "updated_at"  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("tenant_id", "event_id")
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cal_events_tenant_start_idx" ON "calendar_events" ("tenant_id", "start");
