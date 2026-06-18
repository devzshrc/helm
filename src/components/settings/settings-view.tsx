"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import {
  DangerIcon,
  LinkIcon,
  Notification03Icon,
  PaintBrush01Icon,
  Settings02Icon,
  UserCircle02Icon,
} from "@hugeicons/core-free-icons";
import { ShieldCheck } from "lucide-react";

import { ProfileSection } from "~/components/settings/profile-section";
import { IntegrationsSection } from "~/components/settings/integrations-section";
import { AppearanceSection } from "~/components/settings/appearance-section";
import { PreferencesSection } from "~/components/settings/preferences-section";
import { NotificationsSection } from "~/components/settings/notifications-section";
import { DangerZoneSection } from "~/components/settings/danger-zone-section";
import { TrustSafetySection } from "~/components/settings/trust-safety-section";
import type { IntegrationHealth } from "~/lib/integration-health";

type Status = {
  gmail: boolean;
  googlecalendar: boolean;
  integrations?: {
    gmail: IntegrationHealth;
    googlecalendar: IntegrationHealth;
  };
};

const sections = [
  {
    id: "profile",
    label: "Profile",
    description: "Your signed-in Helm identity.",
    icon: UserCircle02Icon,
  },
  {
    id: "integrations",
    label: "Connected Accounts",
    description: "Gmail and Google Calendar access.",
    icon: LinkIcon,
  },
  {
    id: "preferences",
    label: "Preferences",
    description: "Working hours, triage, and writing defaults.",
    icon: Settings02Icon,
  },
  {
    id: "notifications",
    label: "Notifications",
    description: "Alerts and approval reminders.",
    icon: Notification03Icon,
  },
  {
    id: "appearance",
    label: "Appearance",
    description: "Theme and visual preferences.",
    icon: PaintBrush01Icon,
  },
  {
    id: "trust",
    label: "Trust & Safety",
    description: "Permissions, approvals, and data handling.",
    icon: ShieldCheck,
    lucide: true,
  },
  {
    id: "danger",
    label: "Danger Zone",
    description: "Irreversible account actions.",
    icon: DangerIcon,
  },
] as const;

function SectionShell({
  id,
  label,
  description,
  icon,
  lucide,
  children,
}: {
  id: string;
  label: string;
  description: string;
  icon: (typeof sections)[number]["icon"];
  lucide?: boolean;
  children: React.ReactNode;
}) {
  const Icon = icon;
  return (
    <section id={id} className="scroll-mt-20 border-t py-8 first:border-t-0">
      <div className="mb-4 flex items-start gap-3">
        <span className="bg-muted/40 grid size-8 shrink-0 place-items-center rounded-md border">
          {lucide ? (
            <ShieldCheck className="text-muted-foreground size-4" />
          ) : (
            <HugeiconsIcon
              icon={Icon as typeof UserCircle02Icon}
              strokeWidth={2}
              className="text-muted-foreground size-4"
            />
          )}
        </span>
        <div>
          <h2 className="text-base font-semibold">{label}</h2>
          <p className="text-muted-foreground mt-1 text-sm">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

export function SettingsView({
  status,
  user,
}: {
  status: Status;
  user: { name: string; email: string; image?: string | null };
}) {
  return (
    <div className="mx-auto grid max-w-6xl gap-8 p-4 lg:grid-cols-[220px_minmax(0,1fr)] lg:p-8">
      <aside className="hidden lg:block">
        <nav className="sticky top-20 flex flex-col gap-1">
          {sections.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="text-muted-foreground hover:bg-accent hover:text-foreground rounded-md px-3 py-2 text-sm transition-colors"
            >
              {section.label}
            </a>
          ))}
        </nav>
      </aside>
      <main className="bg-background min-w-0 rounded-md border px-4 lg:px-6">
        <SectionShell {...sections[0]}>
          <ProfileSection user={user} />
        </SectionShell>
        <SectionShell {...sections[1]}>
          <IntegrationsSection status={status} />
        </SectionShell>
        <SectionShell {...sections[2]}>
          <PreferencesSection />
        </SectionShell>
        <SectionShell {...sections[3]}>
          <NotificationsSection />
        </SectionShell>
        <SectionShell {...sections[4]}>
          <AppearanceSection />
        </SectionShell>
        <SectionShell {...sections[5]}>
          <TrustSafetySection />
        </SectionShell>
        <SectionShell {...sections[6]}>
          <DangerZoneSection />
        </SectionShell>
      </main>
    </div>
  );
}
