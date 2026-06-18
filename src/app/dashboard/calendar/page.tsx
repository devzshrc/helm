import { CalendarView } from "~/components/calendar/calendar-view";
import { SiteHeader } from "~/components/site-header";

export default function CalendarPage() {
  return (
    <>
      <SiteHeader title="Calendar" />
      <div className="min-h-0 flex-1">
        <CalendarView />
      </div>
    </>
  );
}
