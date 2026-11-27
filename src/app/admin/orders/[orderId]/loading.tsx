/**
 * Instant feedback while the order page (re)loads after an admin action.
 * Without this boundary a slow re-fetch (cold database) leaves the old
 * status on screen with the action button stuck disabled, which reads as
 * if the update never happened.
 */
export default function AdminOrderDetailLoading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-72 animate-pulse rounded bg-slate-200" />
      <div className="h-32 animate-pulse rounded-xl bg-slate-200" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="h-48 animate-pulse rounded-xl bg-slate-200" />
        <div className="h-48 animate-pulse rounded-xl bg-slate-200" />
      </div>
      <div className="h-64 animate-pulse rounded-xl bg-slate-200" />
    </div>
  );
}
