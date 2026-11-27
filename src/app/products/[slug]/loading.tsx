/**
 * Instant feedback while the product page loads. Without this boundary a
 * slow first load (cold database) leaves the old page on screen with no
 * visible change, which reads as a dead link.
 */
export default function ProductDetailLoading() {
  return (
    <main className="flex-1 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="h-4 w-48 animate-pulse rounded bg-slate-200" />
        <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-2">
          <div className="aspect-square animate-pulse rounded-xl bg-slate-200" />
          <div className="space-y-4">
            <div className="h-8 w-3/4 animate-pulse rounded bg-slate-200" />
            <div className="h-8 w-1/3 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-full animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-slate-200" />
            <div className="h-12 w-2/3 animate-pulse rounded-lg bg-slate-200" />
          </div>
        </div>
      </div>
    </main>
  );
}
