import { SiteHeader } from "~/components/site-header";
import { Skeleton } from "~/components/ui/skeleton";

function ThreadRows({ rows = 10 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2 p-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="bg-card/50 flex h-14 items-center gap-3 rounded-lg border px-3"
        >
          <Skeleton className="size-3 rounded-full" />
          <Skeleton className="h-4 w-28 shrink-0" />
          <Skeleton className="h-4 min-w-0 flex-1" />
          <Skeleton className="h-4 w-12 shrink-0" />
        </div>
      ))}
    </div>
  );
}

export function InboxRouteSkeleton({
  withHeader = true,
}: {
  withHeader?: boolean;
}) {
  return (
    <>
      {withHeader ? <SiteHeader title="Inbox" /> : null}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="grid shrink-0 gap-3 border-b px-4 py-4 lg:grid-cols-[minmax(0,1fr)_auto_7rem] lg:items-center lg:px-6">
          <div>
            <Skeleton className="h-8 w-28" />
            <Skeleton className="mt-2 h-4 w-56" />
          </div>
          <Skeleton className="h-10 w-60 rounded-lg" />
          <div />
        </div>
        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(360px,0.7fr)_minmax(0,1fr)]">
          <div className="flex min-h-0 flex-col border-r">
            <div className="space-y-2 border-b p-4">
              <div className="flex gap-2">
                <Skeleton className="h-9 w-20" />
                <Skeleton className="h-9 flex-1" />
                <Skeleton className="size-9" />
              </div>
              <div className="grid grid-cols-2 gap-1 rounded-xl border p-1 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-16 rounded-lg" />
                ))}
              </div>
              <div className="flex gap-1.5 overflow-hidden">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="h-7 w-24 rounded-full" />
                ))}
              </div>
            </div>
            <ThreadRows />
          </div>
          <div className="hidden min-h-0 place-items-center border-l lg:grid">
            <div className="flex flex-col items-center gap-3 text-center">
              <Skeleton className="size-12 rounded-xl" />
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-72" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export function CalendarRouteSkeleton() {
  return (
    <>
      <SiteHeader title="Calendar" />
      <div className="grid h-full min-h-0 gap-3 p-3 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="bg-card/30 flex min-h-0 flex-col rounded-xl border">
          <div className="flex items-center gap-2 border-b px-3 py-2.5">
            <Skeleton className="h-9 w-20" />
            <Skeleton className="size-9" />
            <Skeleton className="size-9" />
            <Skeleton className="h-6 flex-1" />
            <Skeleton className="h-9 w-52" />
          </div>
          <div className="grid flex-1 grid-cols-7 grid-rows-6 gap-px p-3">
            {Array.from({ length: 42 }).map((_, index) => (
              <Skeleton key={index} className="min-h-24 rounded-md" />
            ))}
          </div>
        </div>
        <div className="hidden rounded-xl border p-4 xl:block">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="mt-4 h-28 w-full" />
          <Skeleton className="mt-3 h-28 w-full" />
        </div>
      </div>
    </>
  );
}

export function WorkflowsRouteSkeleton() {
  return (
    <>
      <SiteHeader title="Workflows" />
      <div className="mx-auto flex max-w-5xl flex-col gap-6 p-4 lg:p-8">
        <div className="flex items-end justify-between gap-4 border-b pb-6">
          <div className="min-w-0 flex-1">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="mt-3 h-9 w-96 max-w-full" />
            <Skeleton className="mt-3 h-4 w-[32rem] max-w-full" />
          </div>
          <Skeleton className="h-10 w-44" />
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-24 rounded-lg" />
          ))}
        </div>
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-xl" />
        ))}
      </div>
    </>
  );
}

export function SettingsRouteSkeleton() {
  return (
    <>
      <SiteHeader title="Settings" />
      <div className="mx-auto flex max-w-4xl flex-col gap-4 p-4 lg:p-8">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-xl border p-4">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="mt-2 h-4 w-80 max-w-full" />
            <Skeleton className="mt-4 h-12 w-full" />
          </div>
        ))}
      </div>
    </>
  );
}

export function AgentRouteSkeleton() {
  return (
    <>
      <SiteHeader title="Agent" />
      <div className="grid min-h-0 flex-1 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="hidden border-r p-3 lg:block">
          <Skeleton className="h-10 w-full" />
          <div className="mt-4 space-y-2">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-12 rounded-lg" />
            ))}
          </div>
        </div>
        <div className="flex min-h-0 flex-col items-center justify-end p-4">
          <div className="mt-16 mb-auto w-full max-w-3xl space-y-4">
            <Skeleton className="ml-auto h-12 w-2/3 rounded-2xl" />
            <Skeleton className="h-28 w-3/4 rounded-2xl" />
          </div>
          <Skeleton className="h-14 w-full max-w-3xl rounded-2xl" />
        </div>
      </div>
    </>
  );
}
