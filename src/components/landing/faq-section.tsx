import { FaqPro, type FaqProItem } from "~/components/ui/faq-pro";

const FAQS: FaqProItem[] = [
  {
    id: "what-is-helm",
    question: "What is Helm?",
    answer:
      "Helm is an AI chief-of-staff for your Gmail and Google Calendar. It triages your inbox, drafts replies before you open an email, and schedules meetings on your behalf — all in one fast, keyboard-driven workspace, and nothing is sent without your approval.",
  },
  {
    id: "how-different",
    question:
      "How is Helm different from a smarter inbox like Notion Mail or Superhuman?",
    answer:
      "Most AI inboxes only organize — they sort, label, and categorize. Helm produces finished work: drafted replies waiting before you open the email, and a scheduling concierge that reads incoming requests, checks your real availability, and proposes times for you. Notion Mail's AI organizes your inbox; Helm's AI does the work in it.",
  },
  {
    id: "approval",
    question: "Does Helm send emails or create events on its own?",
    answer:
      "No. Every action that sends, changes, or deletes something is permission-gated — Helm shows you an editable preview (the email, the event, the workflow) and waits for your explicit approval before doing anything.",
  },
  {
    id: "accounts",
    question: "Which accounts does Helm work with?",
    answer:
      "Helm connects to Gmail and Google Calendar. Connect both in a couple of clicks from Settings, and the agent can read, draft, and schedule across them.",
  },
  {
    id: "calendar",
    question: "Is the calendar separate from mail?",
    answer:
      "No — that's a core difference. Helm keeps your inbox and calendar in one workspace, with month, week, and agenda views, plus the scheduling concierge visualizing proposed and confirmed times directly on the calendar.",
  },
  {
    id: "workflows",
    question: "Can I automate things?",
    answer:
      "Yes. Build no-code workflows that run on your mail and calendar automatically — auto-label and file newsletters, draft replies for certain senders, send a daily digest, turn scheduling emails into events, and more. Start from a template or describe it to the agent.",
  },
  {
    id: "agent",
    question: "How do I tell the agent what to do?",
    answer:
      "Just chat. Ask it to summarize unread mail, draft a reply, find free time, or set up a workflow — it shows its work as clean generative UI cards (email lists, threads, drafts, event previews) and asks a clarifying question when it genuinely needs one.",
  },
  {
    id: "open-source",
    question: "Is Helm open source?",
    answer:
      "Yes. Helm is open-source and self-hostable, built on Corsair. The AI features are included by default — no paywall gating the smarts.",
  },
];

export function FaqSection() {
  return (
    <section id="faq" className="mx-auto w-full max-w-3xl px-6 py-24">
      <div className="mb-10 text-center">
        <h2 className="font-serif text-3xl tracking-tight md:text-4xl">
          Questions, answered
        </h2>
        <p className="text-muted-foreground mt-2 text-sm">
          Everything you need to know about how Helm works.
        </p>
      </div>
      <FaqPro defaultOpenFirst items={FAQS} searchPlaceholder="Search FAQs…" />
    </section>
  );
}
