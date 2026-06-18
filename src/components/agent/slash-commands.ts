import {
  CalendarClock,
  CalendarDays,
  type LucideIcon,
  Mail,
  PenLine,
  Sparkles,
  Sun,
  Workflow,
} from "lucide-react";

/**
 * Predefined `/slash` tasks. They drive both the slash-command menu (type `/`
 * in the composer) and the quick-action chips below it. Selecting one sends its
 * `prompt` to the agent.
 */
export interface SlashCommand {
  /** Trigger token, e.g. "/unread". */
  command: string;
  label: string;
  description: string;
  /** The message sent to the agent when this command is chosen. */
  prompt: string;
  icon: LucideIcon;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    command: "/unread",
    label: "Unread mail",
    description: "List my unread emails",
    prompt: "List my unread emails.",
    icon: Mail,
  },
  {
    command: "/today",
    label: "Today",
    description: "Show today's calendar",
    prompt: "What's on my calendar today?",
    icon: CalendarDays,
  },
  {
    command: "/digest",
    label: "Briefing",
    description: "Morning briefing of mail + calendar",
    prompt:
      "Give me a concise morning briefing: summarize my unread mail and today's events, and flag anything that needs a reply.",
    icon: Sun,
  },
  {
    command: "/free",
    label: "Free time",
    description: "Find free slots tomorrow",
    prompt: "When am I free tomorrow?",
    icon: CalendarClock,
  },
  {
    command: "/draft",
    label: "Draft reply",
    description: "Draft a reply to the latest email",
    prompt: "Draft a reply to my most recent email and show it to me.",
    icon: PenLine,
  },
  {
    command: "/triage",
    label: "Triage",
    description: "Summarize inbox + next actions",
    prompt:
      "Triage my inbox: summarize the important threads and tell me what needs action.",
    icon: Sparkles,
  },
  {
    command: "/workflow",
    label: "New workflow",
    description: "Build an automation with the agent",
    prompt:
      "Help me set up a new workflow automation. Ask me what should trigger it and what it should do.",
    icon: Workflow,
  },
];

export function filterCommands(query: string): SlashCommand[] {
  const q = query.toLowerCase().replace(/^\//, "");
  if (!q) return SLASH_COMMANDS;
  return SLASH_COMMANDS.filter(
    (c) =>
      c.command.slice(1).toLowerCase().includes(q) ||
      c.label.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q),
  );
}
