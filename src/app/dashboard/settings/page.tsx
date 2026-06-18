import { SettingsView } from "~/components/settings/settings-view";
import { SiteHeader } from "~/components/site-header";
import { getSession } from "~/server/better-auth/server";
import { api } from "~/trpc/server";

export default async function SettingsPage() {
  const session = await getSession();
  const status = await api.connections.status();
  return (
    <>
      <SiteHeader title="Settings" />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <SettingsView
          status={status}
          user={{
            name: session?.user.name ?? "",
            email: session?.user.email ?? "",
            image: session?.user.image,
          }}
        />
      </div>
    </>
  );
}
