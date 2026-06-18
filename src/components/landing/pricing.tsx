import { Check } from "lucide-react";

const PLANS = [
  {
    name: "Free Beta",
    price: "$0",
    note: "Early access",
    description: "For individuals trying Helm with Gmail and Calendar.",
    features: [
      "AI inbox and calendar workspace",
      "Draft replies and meeting actions",
      "Workflow builder beta",
      "Approval-gated writes",
    ],
    cta: "Start free",
  },
  {
    name: "Pro",
    price: "Soon",
    note: "For power users",
    description: "Higher limits, deeper automations, and priority workflows.",
    features: [
      "Advanced workflow templates",
      "Longer history and richer search",
      "Priority sync and support",
      "More automation capacity",
    ],
    cta: "Included in beta",
  },
  {
    name: "Team",
    price: "Soon",
    note: "For shared work",
    description: "Admin controls and shared operating rules for teams.",
    features: [
      "Team workspace controls",
      "Shared preferences and policies",
      "Audit-friendly action history",
      "Concierge onboarding",
    ],
    cta: "Talk to us",
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="bg-muted/30 py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-muted-foreground text-xs font-medium tracking-[0.2em] uppercase">
            Pricing
          </p>
          <h2 className="text-foreground mt-3 text-3xl font-light tracking-tight md:text-4xl">
            Simple while Helm is in beta.
          </h2>
          <p className="text-muted-foreground mt-3">
            Start free during early access. Paid plans will arrive when the
            product is ready for heavier individual and team usage.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {PLANS.map((plan, index) => (
            <article
              key={plan.name}
              className="bg-background flex min-h-[28rem] flex-col rounded-2xl border p-6 shadow-sm"
            >
              <div>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold">{plan.name}</h3>
                  {index === 0 ? (
                    <span className="bg-primary/10 text-primary rounded-full px-2.5 py-1 text-xs font-semibold">
                      Current
                    </span>
                  ) : null}
                </div>
                <div className="mt-5 flex items-end gap-2">
                  <span className="text-4xl font-semibold tracking-tight">
                    {plan.price}
                  </span>
                  <span className="text-muted-foreground pb-1 text-sm">
                    {plan.note}
                  </span>
                </div>
                <p className="text-muted-foreground mt-4 text-sm leading-6">
                  {plan.description}
                </p>
              </div>

              <ul className="mt-6 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2 text-sm">
                    <Check className="text-primary mt-0.5 size-4 shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <a
                href={index === 2 ? "mailto:hello@helm.app" : "/login"}
                className="hover:bg-accent mt-auto inline-flex h-10 items-center justify-center rounded-lg border px-4 text-sm font-medium transition-colors"
              >
                {plan.cta}
              </a>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
