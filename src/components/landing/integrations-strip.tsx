import type { IconType } from "react-icons";
import { SiGmail, SiGooglecalendar } from "react-icons/si";

type Integration = { icon: IconType; name: string; color: string };

const INTEGRATIONS: Integration[] = [
  { icon: SiGmail, name: "Gmail", color: "#EA4335" },
  { icon: SiGooglecalendar, name: "Google Calendar", color: "#4285F4" },
];

export function IntegrationsStrip() {
  return (
    <section className="py-12">
      <div className="mx-auto max-w-5xl px-6">
        <p className="text-muted-foreground mb-6 text-center text-xs font-medium tracking-wide uppercase">
          Connects directly to
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {INTEGRATIONS.map(({ icon: Icon, name, color }) => (
            <div
              key={name}
              className="bg-card flex items-center gap-2 rounded-full border px-4 py-2"
            >
              <Icon className="size-4" style={{ color }} />
              <span className="text-sm font-medium">{name}</span>
            </div>
          ))}
          <div className="text-muted-foreground/70 flex items-center gap-2 rounded-full border border-dashed px-4 py-2">
            <span className="text-sm">More on the way</span>
          </div>
        </div>
      </div>
    </section>
  );
}
