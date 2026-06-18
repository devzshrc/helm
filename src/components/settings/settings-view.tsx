"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import {
  UserCircle02Icon,
  LinkIcon,
  PaintBrush01Icon,
  Settings02Icon,
  Notification03Icon,
  DangerIcon,
} from "@hugeicons/core-free-icons";
import { ShieldCheck } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { ProfileSection } from "~/components/settings/profile-section";
import { IntegrationsSection } from "~/components/settings/integrations-section";
import { AppearanceSection } from "~/components/settings/appearance-section";
import { PreferencesSection } from "~/components/settings/preferences-section";
import { NotificationsSection } from "~/components/settings/notifications-section";
import { DangerZoneSection } from "~/components/settings/danger-zone-section";
import { TrustSafetySection } from "~/components/settings/trust-safety-section";

type Status = { gmail: boolean; googlecalendar: boolean };

const tabs = [
  { value: "profile", label: "Profile", icon: UserCircle02Icon },
  { value: "integrations", label: "Integrations", icon: LinkIcon },
  { value: "appearance", label: "Appearance", icon: PaintBrush01Icon },
  { value: "preferences", label: "Preferences", icon: Settings02Icon },
  { value: "notifications", label: "Notifications", icon: Notification03Icon },
  { value: "trust", label: "Trust", icon: ShieldCheck, lucide: true },
  { value: "danger", label: "Danger Zone", icon: DangerIcon },
] as const;

export function SettingsView({
  status,
  user,
}: {
  status: Status;
  user: { name: string; email: string; image?: string | null };
}) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <Tabs defaultValue="profile">
        <TabsList
          variant="line"
          className="w-full justify-start overflow-x-auto"
        >
          {tabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {"lucide" in tab ? (
                <ShieldCheck className="h-4 w-4" />
              ) : (
                <HugeiconsIcon icon={tab.icon} strokeWidth={2} />
              )}
              <span className="hidden sm:inline">{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="profile">
          <ProfileSection user={user} />
        </TabsContent>

        <TabsContent value="integrations">
          <IntegrationsSection status={status} />
        </TabsContent>

        <TabsContent value="appearance">
          <AppearanceSection />
        </TabsContent>

        <TabsContent value="preferences">
          <PreferencesSection />
        </TabsContent>

        <TabsContent value="notifications">
          <NotificationsSection />
        </TabsContent>

        <TabsContent value="trust">
          <TrustSafetySection />
        </TabsContent>

        <TabsContent value="danger">
          <DangerZoneSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
