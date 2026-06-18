// Shared workflow contract — client + server safe (no server-only imports).

export type TriggerType = "email" | "schedule" | "calendar";

export type NodeType =
  | "filter"
  | "ai_summarize"
  | "ai_draft"
  | "ai_classify"
  | "ai_digest"
  | "label"
  | "archive"
  | "mark_read"
  | "star"
  | "reply"
  | "forward"
  | "send_email"
  | "move_to_label"
  | "add_note"
  | "create_event";

export type WorkflowNode = {
  id: string;
  type: NodeType;
  config: Record<string, string>;
};

export type WorkflowTrigger = {
  type: TriggerType;
  config: Record<string, string>;
};

export type FieldDescriptor = {
  key: string;
  label: string;
  type: "text" | "textarea" | "select" | "label";
  placeholder?: string;
  options?: { value: string; label: string }[];
  optional?: boolean;
};

export type NodeMeta = {
  label: string;
  description: string;
  /** Which trigger types this step is valid under. */
  triggers: TriggerType[];
  fields: FieldDescriptor[];
};

// --- trigger metadata ---
export const TRIGGER_META: Record<
  TriggerType,
  { label: string; description: string; fields: FieldDescriptor[] }
> = {
  email: {
    label: "New email arrives",
    description: "Runs when a matching email lands in your inbox.",
    fields: [
      {
        key: "fromContains",
        label: "From contains",
        placeholder: "boss@company.com",
        type: "text",
        optional: true,
      },
      {
        key: "subjectContains",
        label: "Subject contains",
        placeholder: "invoice",
        type: "text",
        optional: true,
      },
      {
        key: "bodyContains",
        label: "Body contains",
        placeholder: "contract renewal",
        type: "text",
        optional: true,
      },
      {
        key: "labelIncludes",
        label: "Label includes",
        placeholder: "Important",
        type: "label",
        optional: true,
      },
      {
        key: "priorityIs",
        label: "Priority is",
        type: "select",
        optional: true,
        options: [
          { value: "Urgent", label: "Urgent" },
          { value: "Important", label: "Important" },
          { value: "Routine", label: "Routine" },
          { value: "Noise", label: "Noise" },
        ],
      },
      {
        key: "hasAttachment",
        label: "Has attachment",
        type: "select",
        optional: true,
        options: [
          { value: "any", label: "Either" },
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
        ],
      },
    ],
  },
  schedule: {
    label: "On a schedule",
    description: "Runs automatically on a recurring schedule.",
    fields: [
      {
        key: "frequency",
        label: "Frequency",
        type: "select",
        options: [
          { value: "hourly", label: "Every hour" },
          { value: "daily", label: "Once a day (08:00)" },
        ],
      },
    ],
  },
  calendar: {
    label: "Calendar event changes",
    description: "Runs when a calendar event is created, updated, or deleted.",
    fields: [
      {
        key: "action",
        label: "Event action",
        type: "select",
        optional: true,
        options: [
          { value: "any", label: "Any change" },
          { value: "created", label: "Created" },
          { value: "updated", label: "Updated" },
          { value: "deleted", label: "Deleted" },
        ],
      },
      {
        key: "titleContains",
        label: "Title contains",
        placeholder: "interview",
        type: "text",
        optional: true,
      },
      {
        key: "attendeeContains",
        label: "Attendee contains",
        placeholder: "client.com",
        type: "text",
        optional: true,
      },
      {
        key: "locationContains",
        label: "Location contains",
        placeholder: "Zoom",
        type: "text",
        optional: true,
      },
    ],
  },
};

const EMAIL_CTX: TriggerType[] = ["email"];
const MESSAGE_CTX: TriggerType[] = ["email", "calendar"];
const ALL: TriggerType[] = ["email", "schedule", "calendar"];

// --- node catalog ---
export const NODE_META: Record<NodeType, NodeMeta> = {
  filter: {
    label: "Filter",
    description: "Stop unless a condition is met.",
    triggers: MESSAGE_CTX,
    fields: [
      {
        key: "field",
        label: "Check",
        type: "select",
        options: [
          { value: "from", label: "From" },
          { value: "subject", label: "Subject" },
          { value: "body", label: "Body" },
          { value: "ai", label: "Ask AI (yes/no)" },
        ],
      },
      {
        key: "op",
        label: "Condition",
        type: "select",
        options: [
          { value: "contains", label: "contains" },
          { value: "not_contains", label: "does not contain" },
        ],
      },
      {
        key: "value",
        label: "Value / question",
        type: "text",
        placeholder: "e.g. urgent  /  Is this from a customer?",
      },
    ],
  },
  ai_summarize: {
    label: "AI: Summarize",
    description: "Summarize the email into {{summary}}.",
    triggers: EMAIL_CTX,
    fields: [],
  },
  ai_draft: {
    label: "AI: Draft reply",
    description: "Draft a reply into {{draft}}.",
    triggers: EMAIL_CTX,
    fields: [
      {
        key: "instruction",
        label: "Instruction (optional)",
        type: "text",
        optional: true,
        placeholder: "Politely decline",
      },
    ],
  },
  ai_classify: {
    label: "AI: Classify priority",
    description: "Set {{priority}} to Urgent/Important/Routine/Noise.",
    triggers: EMAIL_CTX,
    fields: [],
  },
  ai_digest: {
    label: "AI: Digest unread",
    description: "Summarize last 24h unread into {{digest}}.",
    triggers: ["schedule"],
    fields: [],
  },
  label: {
    label: "Add label",
    description: "Apply a Gmail label (created if missing).",
    triggers: EMAIL_CTX,
    fields: [
      {
        key: "labelName",
        label: "Label",
        type: "label",
        placeholder: "Newsletters",
      },
    ],
  },
  archive: {
    label: "Archive",
    description: "Remove from inbox.",
    triggers: EMAIL_CTX,
    fields: [],
  },
  mark_read: {
    label: "Mark read",
    description: "Mark the thread read.",
    triggers: EMAIL_CTX,
    fields: [],
  },
  star: {
    label: "Star",
    description: "Star the thread.",
    triggers: EMAIL_CTX,
    fields: [],
  },
  reply: {
    label: "Reply",
    description: "Reply (uses {{draft}} if blank).",
    triggers: EMAIL_CTX,
    fields: [
      {
        key: "text",
        label: "Reply text",
        type: "textarea",
        optional: true,
        placeholder: "Leave blank to send {{draft}}",
      },
    ],
  },
  forward: {
    label: "Forward",
    description: "Forward the email.",
    triggers: EMAIL_CTX,
    fields: [
      {
        key: "to",
        label: "Forward to",
        type: "text",
        placeholder: "team@company.com",
      },
    ],
  },
  send_email: {
    label: "Send email",
    description: "Send a new email (supports {{vars}}).",
    triggers: ALL,
    fields: [
      { key: "to", label: "To", type: "text", placeholder: "me@me.com" },
      { key: "subject", label: "Subject", type: "text" },
      {
        key: "body",
        label: "Body",
        type: "textarea",
        placeholder: "{{summary}} or {{digest}}",
      },
    ],
  },
  move_to_label: {
    label: "Move to label",
    description: "Apply a Gmail label and archive the thread.",
    triggers: EMAIL_CTX,
    fields: [
      {
        key: "labelName",
        label: "Label",
        type: "label",
        placeholder: "Receipts",
      },
    ],
  },
  add_note: {
    label: "Add run note",
    description: "Record an internal note in the workflow run log.",
    triggers: ALL,
    fields: [
      {
        key: "text",
        label: "Note",
        type: "textarea",
        placeholder: "Matched {{subject}} from {{from}}",
      },
    ],
  },
  create_event: {
    label: "Create calendar event",
    description: "Create an event (from the email when possible).",
    triggers: EMAIL_CTX,
    fields: [
      {
        key: "summary",
        label: "Title (optional — AI extracts if blank)",
        type: "text",
        optional: true,
      },
    ],
  },
};

export function nodesForTrigger(trigger: TriggerType): NodeType[] {
  return (Object.keys(NODE_META) as NodeType[]).filter((t) =>
    NODE_META[t].triggers.includes(trigger),
  );
}

// --- curated "predict next step" ---
const NEXT: Record<string, NodeType[]> = {
  "email:start": ["filter", "ai_summarize", "label", "ai_draft"],
  "email:filter": ["label", "ai_summarize", "archive", "star"],
  "email:ai_summarize": ["send_email", "label", "reply", "create_event"],
  "email:ai_draft": ["reply", "send_email"],
  "email:ai_classify": ["filter", "label", "archive"],
  "email:label": ["archive", "star", "mark_read"],
  "email:move_to_label": ["star", "mark_read"],
  "calendar:start": ["send_email", "filter"],
  "schedule:start": ["ai_digest", "send_email"],
  "schedule:ai_digest": ["send_email"],
};

export function suggestNext(
  trigger: TriggerType,
  lastType: NodeType | null,
): NodeType[] {
  const key = `${trigger}:${lastType ?? "start"}`;
  const picks = NEXT[key] ?? nodesForTrigger(trigger).slice(0, 5);
  return picks.filter((t) => NODE_META[t].triggers.includes(trigger));
}

// --- premade templates ---
let nid = 0;
const n = (
  type: NodeType,
  config: Record<string, string> = {},
): WorkflowNode => ({
  id: `seed-${type}-${nid++}`,
  type,
  config,
});

export type Template = {
  id: string;
  name: string;
  description: string;
  trigger: WorkflowTrigger;
  nodes: WorkflowNode[];
};

export const TEMPLATES: Template[] = [
  {
    id: "newsletters",
    name: "Tidy newsletters",
    description: "Auto-label promotional mail and clear it from the inbox.",
    trigger: { type: "email", config: {} },
    nodes: [
      n("ai_classify"),
      n("filter", {
        field: "ai",
        op: "contains",
        value: "Is this a newsletter or marketing email?",
      }),
      n("label", { labelName: "Newsletters" }),
      n("archive"),
    ],
  },
  {
    id: "vip",
    name: "VIP spotlight",
    description: "Summarize and star mail from important people.",
    trigger: { type: "email", config: { fromContains: "" } },
    nodes: [n("ai_summarize"), n("star"), n("label", { labelName: "VIP" })],
  },
  {
    id: "autodraft",
    name: "Auto-draft replies",
    description: "Draft a reply for matching emails so you just review & send.",
    trigger: { type: "email", config: { subjectContains: "" } },
    nodes: [n("ai_draft", { instruction: "" }), n("reply", { text: "" })],
  },
  {
    id: "meeting",
    name: "Meeting from email",
    description: "Turn a scheduling email into a calendar event.",
    trigger: { type: "email", config: { subjectContains: "meeting" } },
    nodes: [n("create_event", {})],
  },
  {
    id: "digest",
    name: "Daily digest",
    description: "Each morning, email yourself a summary of unread mail.",
    trigger: { type: "schedule", config: { frequency: "daily" } },
    nodes: [
      n("ai_digest"),
      n("send_email", {
        to: "",
        subject: "Your daily digest",
        body: "{{digest}}",
      }),
    ],
  },
  {
    id: "receipts",
    name: "File receipts",
    description: "Label receipts/invoices and archive them.",
    trigger: { type: "email", config: { subjectContains: "receipt" } },
    nodes: [n("label", { labelName: "Receipts" }), n("archive")],
  },
];
