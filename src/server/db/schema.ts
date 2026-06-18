import {
  pgTable,
  text,
  jsonb,
  timestamp,
  boolean,
  vector,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// better-auth tables (resolved by model name: user/session/account/verification)
// ---------------------------------------------------------------------------

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const corsairIntegrations = pgTable("corsair_integrations", {
  id: text("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  name: text("name").notNull(),
  config: jsonb("config").notNull().default({}),
  dek: text("dek"),
});

export const corsairAccounts = pgTable("corsair_accounts", {
  id: text("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  tenantId: text("tenant_id").notNull(),
  integrationId: text("integration_id")
    .notNull()
    .references(() => corsairIntegrations.id),
  config: jsonb("config").notNull().default({}),
  dek: text("dek"),
});

export const corsairEntities = pgTable("corsair_entities", {
  id: text("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  accountId: text("account_id")
    .notNull()
    .references(() => corsairAccounts.id),
  entityId: text("entity_id").notNull(),
  entityType: text("entity_type").notNull(),
  version: text("version").notNull(),
  data: jsonb("data").notNull().default({}),
});

export const corsairEvents = pgTable("corsair_events", {
  id: text("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  accountId: text("account_id")
    .notNull()
    .references(() => corsairAccounts.id),
  eventType: text("event_type").notNull(),
  payload: jsonb("payload").notNull().default({}),
  status: text("status"),
});

// ---------------------------------------------------------------------------
// Helm app tables (all tenant-scoped: tenant_id = better-auth user id)
// ---------------------------------------------------------------------------

/**
 * Per-message app state sidecar. Email bodies live in Corsair's cache / live
 * API; here we only keep triage priority, snooze state, and the fields needed
 * for list rendering + semantic search (incl. the embedding).
 */
export const emailMeta = pgTable(
  "email_meta",
  {
    tenantId: text("tenant_id").notNull(),
    gmailId: text("gmail_id").notNull(),
    threadId: text("thread_id").notNull(),
    // Urgent | Important | Routine | Noise (null = not yet classified)
    priority: text("priority"),
    snoozedUntil: timestamp("snoozed_until", { withTimezone: true }),
    fromAddr: text("from_addr"),
    subject: text("subject"),
    snippet: text("snippet"),
    receivedAt: timestamp("received_at", { withTimezone: true }),
    embedding: vector("embedding", { dimensions: 768 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.tenantId, t.gmailId] }),
    index("email_meta_tenant_thread_idx").on(t.tenantId, t.threadId),
    index("email_meta_tenant_priority_idx").on(t.tenantId, t.priority),
  ],
);

export const emailBodies = pgTable(
  "email_bodies",
  {
    tenantId: text("tenant_id").notNull(),
    gmailId: text("gmail_id").notNull(),
    html: text("html").notNull(),
    cachedAt: timestamp("cached_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.gmailId] })],
);

export const calendarEvents = pgTable(
  "calendar_events",
  {
    tenantId: text("tenant_id").notNull(),
    eventId: text("event_id").notNull(),
    title: text("title").notNull().default(""),
    start: text("start"),
    end: text("end"),
    allDay: boolean("all_day").notNull().default(false),
    location: text("location"),
    description: text("description"),
    attendees: jsonb("attendees").notNull().default([]),
    htmlLink: text("html_link"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.tenantId, t.eventId] }),
    index("cal_events_tenant_start_idx").on(t.tenantId, t.start),
  ],
);

export const chatSessions = pgTable("chat_sessions", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  title: text("title"),
  // Full AG-UI message snapshot for the CopilotKit conversation (per-session).
  messages: jsonb("messages").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => chatSessions.id, { onDelete: "cascade" }),
    tenantId: text("tenant_id").notNull(),
    role: text("role").notNull(), // user | assistant | tool
    content: text("content"),
    toolCalls: jsonb("tool_calls"),
    // For permission-gated mutations: pending | approved | rejected | done
    actionStatus: text("action_status"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("chat_messages_session_idx").on(t.sessionId)],
);

export const userPreferences = pgTable("user_preferences", {
  tenantId: text("tenant_id").primaryKey(),
  shortcuts: jsonb("shortcuts").notNull().default({}),
  focusThreshold: text("focus_threshold").notNull().default("Important"),
  triagePrefs: jsonb("triage_prefs").notNull().default({}),
  // IANA timezone (e.g. "America/New_York"), captured from the browser. Used
  // by the scheduling concierge to compute business-hour slots in the user's
  // local time instead of the server's UTC.
  timezone: text("timezone").notNull().default("UTC"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const workflows = pgTable(
  "workflows",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    name: text("name").notNull(),
    enabled: boolean("enabled").notNull().default(false),
    // { type: 'email'|'schedule'|'calendar', config: {...} }
    trigger: jsonb("trigger").notNull().default({}),
    // ordered list of { id, type, config }
    nodes: jsonb("nodes").notNull().default([]),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("workflows_tenant_idx").on(t.tenantId),
    // Cron drains scan all enabled workflows across tenants.
    index("workflows_enabled_idx").on(t.enabled),
  ],
);

/** Scheduling Concierge: one negotiation per scheduling email thread. */
export const schedulingNegotiations = pgTable(
  "scheduling_negotiations",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    threadId: text("thread_id").notNull(),
    counterpartyEmail: text("counterparty_email"),
    counterpartyName: text("counterparty_name"),
    subject: text("subject"),
    // awaiting_approval | awaiting_response | awaiting_confirm | confirmed |
    // needs_review | no_slots | declined | dismissed
    status: text("status").notNull(),
    intent: text("intent"), // request | confirmation
    proposedSlots: jsonb("proposed_slots").notNull().default([]), // [{start,end}]
    chosenSlot: jsonb("chosen_slot"), // {start,end}
    draftReply: text("draft_reply"),
    eventId: text("event_id"),
    proposalGroupId: text("proposal_group_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("negotiations_tenant_idx").on(t.tenantId),
    index("negotiations_thread_idx").on(t.threadId),
  ],
);

/** Chronological agent actions powering the calendar activity rail. */
export const agentActivityLog = pgTable(
  "agent_activity_log",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    negotiationId: text("negotiation_id"),
    eventType: text("event_type").notNull(), // detected|proposed|confirmed|event_created|needs_review|declined
    description: text("description").notNull(),
    linkThreadId: text("link_thread_id"),
    linkEventId: text("link_event_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("activity_tenant_idx").on(t.tenantId)],
);

export const workflowRuns = pgTable(
  "workflow_runs",
  {
    id: text("id").primaryKey(),
    workflowId: text("workflow_id")
      .notNull()
      .references(() => workflows.id, { onDelete: "cascade" }),
    tenantId: text("tenant_id").notNull(),
    // success | failed | stopped | skipped | running
    status: text("status").notNull(),
    input: jsonb("input"),
    steps: jsonb("steps").notNull().default([]),
    error: text("error"),
    // message/event id — dedupes repeated trigger deliveries
    dedupeKey: text("dedupe_key"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [
    index("workflow_runs_wf_idx").on(t.workflowId),
    index("workflow_runs_dedupe_idx").on(t.workflowId, t.dedupeKey),
  ],
);

export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id"),
    plugin: text("plugin"),
    action: text("action"),
    status: text("status"),
    raw: jsonb("raw").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  // Powers the lightweight sync cursor (max(created_at) per tenant): the client
  // polls this one indexed value instead of re-fetching the whole inbox/calendar
  // on an interval. Descending index scan → O(1) lookup.
  (t) => [
    index("webhook_events_tenant_created_idx").on(t.tenantId, t.createdAt),
  ],
);

export const webhookSubscriptions = pgTable(
  "webhook_subscriptions",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    plugin: text("plugin").notNull(),
    channelId: text("channel_id"),
    resourceId: text("resource_id"),
    externalAccountId: text("external_account_id"),
    status: text("status").notNull().default("unknown"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("webhook_subscriptions_tenant_idx").on(t.tenantId),
    index("webhook_subscriptions_channel_idx").on(t.plugin, t.channelId),
    index("webhook_subscriptions_external_idx").on(
      t.plugin,
      t.externalAccountId,
    ),
  ],
);
