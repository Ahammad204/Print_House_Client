import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-center px-4 py-24 text-center sm:px-6 lg:px-8">
      <p className="text-7xl font-bold text-primary">404</p>
      <h1 className="mt-4 text-2xl font-bold text-navy sm:text-3xl">
        Page not found
      </h1>
      <p className="mt-3 max-w-md text-slate-600">
        Sorry, the page you are looking for does not exist or has been moved.
        Please check the address or head back to the home page.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-4">
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-base font-semibold text-white transition hover:bg-primary-dark"
        >
          Go to Home
        </Link>
        <Link
          href="/products"
          className="inline-flex items-center justify-center rounded-lg border border-primary px-6 py-3 text-base font-semibold text-primary transition hover:bg-primary/5"
        >
          Browse Products
        </Link>
      </div>
    </main>
  );
}
