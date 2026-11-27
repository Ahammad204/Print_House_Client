export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="h-10 w-64 animate-pulse rounded-lg bg-slate-200" />
      <div className="mt-4 h-5 w-96 max-w-full animate-pulse rounded-lg bg-slate-200" />
      <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
          >
            <div className="aspect-[4/3] w-full animate-pulse bg-slate-200" />
            <div className="space-y-3 p-4">
              <div className="h-4 w-1/3 animate-pulse rounded bg-slate-200" />
              <div className="h-5 w-full animate-pulse rounded bg-slate-200" />
              <div className="h-4 w-2/3 animate-pulse rounded bg-slate-200" />
              <div className="h-9 w-full animate-pulse rounded-lg bg-slate-200" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
