import { CommandCenter } from "~/components/dashboard/command-center";
import { SiteHeader } from "~/components/site-header";

export default function DashboardPage() {
  return (
    <>
      <SiteHeader title="Today" />
      <CommandCenter />
    </>
  );
}
