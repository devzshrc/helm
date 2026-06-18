import { SiteHeader } from "~/components/site-header";
import { Skeleton } from "~/components/ui/skeleton";

/**
 * Shared `loading.tsx` body for dashboard data segments. Mirrors the page shell
 * (SiteHeader + a column of rows) so navigation paints instantly instead of a
 * blank frame while the client query resolves.
 */
export function SegmentSkeleton({
  title,
  rows = 6,
}: {
  title: string;
  rows?: number;
}) {
  return (
    <>
      <SiteHeader title={title} />
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 p-4 lg:p-6">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    </>
  );
}
