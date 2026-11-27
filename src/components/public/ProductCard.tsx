import Image from "next/image";
import Link from "next/link";
import { formatBDT } from "@/lib/utils";
import { effectivePrice, type PublicProduct } from "./types";

function AvailabilityBadge({ status }: { status: string }) {
  if (status === "available") {
    return (
      <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
        Available
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
      Out of Stock
    </span>
  );
}

export default function ProductCard({ product }: { product: PublicProduct }) {
  const image = product.images?.[0]?.url ?? "/images/products/gift-box.svg";
  const imageAlt = product.images?.[0]?.alt ?? product.name;
  const { current, original } = effectivePrice(product);

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
      <Link
        href={`/products/${product.slug}`}
        className="relative block aspect-[4/3] w-full overflow-hidden bg-slate-100"
      >
        <Image
          src={image}
          alt={imageAlt}
          width={800}
          height={600}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
        />
        <span className="absolute left-3 top-3">
          <AvailabilityBadge status={product.status} />
        </span>
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-primary">
          {product.category?.name ?? "General"}
        </p>
        <Link href={`/products/${product.slug}`}>
          <h3 className="mt-1 line-clamp-2 text-base font-semibold text-navy hover:text-primary">
            {product.name}
          </h3>
        </Link>
        <p className="mt-1 line-clamp-2 text-sm text-slate-500">
          {product.description}
        </p>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-lg font-bold text-navy">
            {formatBDT(current)}
          </span>
          {original !== null && (
            <span className="text-sm text-slate-400 line-through">
              {formatBDT(original)}
            </span>
          )}
        </div>
        <Link
          href={`/products/${product.slug}`}
          className="mt-4 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark"
        >
          View Details
        </Link>
      </div>
    </article>
  );
}
