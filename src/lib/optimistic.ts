import { type QueryClient, type QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";

/**
 * Optimistic-update helpers for tRPC list queries.
 *
 * Every mutation in the app used to be invalidate-on-success, so list/toggle
 * actions waited for a full server round-trip before the UI moved. These
 * helpers build the react-query `onMutate -> cancel -> snapshot -> setData`,
 * `onError` rollback, `onSettled` invalidate lifecycle so the UI updates
 * instantly and self-heals if the server rejects.
 *
 * They operate on the raw QueryClient with a (partial) tRPC query key so a
 * single call can patch every cached variant of a query — e.g. all `mail.list`
 * caches regardless of the `{ q }` filter. Derive the key with `getQueryKey`
 * from `@trpc/react-query`, e.g. `getQueryKey(api.mail.list)`.
 */

type Snapshot = [QueryKey, unknown][];

/** Shared lifecycle. `apply` transforms the cached array for a given mutation. */
function optimisticList<TVars, TItem>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  apply: (items: TItem[], vars: TVars) => TItem[],
  errorMessage?: string,
) {
  return {
    onMutate: async (vars: TVars) => {
      // Stop in-flight refetches from clobbering the optimistic write.
      await queryClient.cancelQueries({ queryKey });
      const snapshot = queryClient.getQueriesData({ queryKey }) as Snapshot;
      queryClient.setQueriesData<TItem[]>({ queryKey }, (old) =>
        old ? apply(old, vars) : old,
      );
      return { snapshot };
    },
    onError: (
      _err: unknown,
      _vars: TVars,
      ctx: { snapshot: Snapshot } | undefined,
    ) => {
      ctx?.snapshot.forEach(([key, data]) =>
        queryClient.setQueryData(key, data),
      );
      if (errorMessage) toast.error(errorMessage);
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey });
    },
  };
}

/** Drop matching items from the cached list (archive / trash / delete / dismiss). */
export function removeFromList<TVars, TItem>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  match: (item: TItem, vars: TVars) => boolean,
  errorMessage?: string,
) {
  return optimisticList<TVars, TItem>(
    queryClient,
    queryKey,
    (items, vars) => items.filter((it) => !match(it, vars)),
    errorMessage,
  );
}

/** Patch matching items in the cached list (star / mark-read / toggle enabled). */
export function patchInList<TVars, TItem>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  match: (item: TItem, vars: TVars) => boolean,
  patch: (item: TItem, vars: TVars) => TItem,
  errorMessage?: string,
) {
  return optimisticList<TVars, TItem>(
    queryClient,
    queryKey,
    (items, vars) =>
      items.map((it) => (match(it, vars) ? patch(it, vars) : it)),
    errorMessage,
  );
}
