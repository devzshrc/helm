import {
  CalendarClock,
  type LucideIcon,
  Mail,
  PenLine,
  ShieldCheck,
  Workflow,
  Zap,
} from "lucide-react";

import { Card, CardContent } from "~/components/ui/card";

type Feature = { icon: LucideIcon; title: string; description: string };

const FEATURES: Feature[] = [
  {
    icon: Mail,
    title: "Unified inbox + calendar",
    description:
      "Mail and calendar in one fast, keyboard-driven workspace — triage, reply, and schedule without switching apps.",
  },
  {
    icon: ShieldCheck,
    title: "Approval-gated by default",
    description:
      "Every send, edit, or delete shows an editable preview and waits for your explicit yes. Nothing happens silently.",
  },
  {
    icon: PenLine,
    title: "Ready replies",
    description:
      "Drafts written before you open the email — review, tweak, and send in a click instead of starting from blank.",
  },
  {
    icon: CalendarClock,
    title: "Scheduling concierge",
    description:
      "The agent reads a request, checks your real availability, and proposes times — you just confirm.",
  },
  {
    icon: Workflow,
    title: "No-code workflows",
    description:
      "Automate triage, labels, replies, and daily digests across mail and calendar. Start from a template or describe it.",
  },
  {
    icon: Zap,
    title: "Live, real-time",
    description:
      "Webhook-driven updates stream in instantly over SSE — your inbox is always current, no refresh needed.",
  },
];

export function FeatureSection() {
  return (
    <section className="bg-muted/30 py-16 md:py-28 dark:bg-transparent">
      <div className="mx-auto max-w-5xl px-6">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="font-serif text-3xl tracking-tight md:text-4xl">
            Everything, in one place
          </h2>
          <p className="text-muted-foreground mt-2 text-sm md:text-base">
            A fast, unified workspace where the agent does the work — with your
            approval.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <Card
              key={title}
              className="group hover:border-primary/30 transition-colors"
            >
              <CardContent className="flex h-full flex-col gap-4 p-6">
                <div className="bg-primary/10 text-primary grid size-11 shrink-0 place-items-center rounded-xl">
                  <Icon className="size-5" strokeWidth={1.75} />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-base font-semibold">{title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {description}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
