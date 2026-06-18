import Link from "next/link";
import { BRAND } from "~/lib/brand";

const sections = [
  {
    title: "What we collect",
    body: `We collect your email address, name, and OAuth tokens needed to connect your Gmail and Google Calendar. We also store the emails and calendar events you access through ${BRAND}, along with usage data to improve the product.`,
  },
  {
    title: "How we use it",
    body: `Your data is used solely to power ${BRAND} features — reading and sending email, managing calendar events, and running automations you configure. We do not sell your data or use it to train AI models without your explicit consent.`,
  },
  {
    title: "Third-party services",
    body: "We use Google APIs to access your Gmail and Calendar. Your data is subject to Google's privacy policy in addition to ours. We use Vercel for hosting and a managed database provider for storage — both operate under strict data processing agreements.",
  },
  {
    title: "Data retention",
    body: "We retain your data for as long as your account is active. You can delete your account at any time from Settings, which permanently removes all your data within 30 days.",
  },
  {
    title: "Security",
    body: "All data is encrypted in transit (TLS) and at rest. OAuth tokens are stored encrypted and never exposed in plaintext. We follow industry-standard security practices and review them regularly.",
  },
  {
    title: "Your rights",
    body: "You have the right to access, export, or delete your personal data at any time. To exercise these rights, go to Settings or contact us at the address below.",
  },
  {
    title: "Contact",
    body: `Questions about this policy? Email us at privacy@${BRAND.toLowerCase()}.app.`,
  },
];

export const metadata = {
  title: `Privacy Policy — ${BRAND}`,
  description: `How ${BRAND} collects, uses, and protects your data.`,
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-20">
      <Link
        href="/"
        className="text-muted-foreground hover:text-foreground mb-10 block text-sm transition-colors"
      >
        ← Back
      </Link>

      <h1 className="text-foreground font-serif text-3xl tracking-tight">
        Privacy Policy
      </h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Last updated: June 2026
      </p>

      <div className="mt-12 space-y-10">
        {sections.map((s) => (
          <section key={s.title}>
            <h2 className="text-muted-foreground mb-2 text-sm font-semibold tracking-wide uppercase">
              {s.title}
            </h2>
            <p className="text-foreground/80 text-sm leading-relaxed">
              {s.body}
            </p>
          </section>
        ))}
      </div>
    </div>
  );
}
