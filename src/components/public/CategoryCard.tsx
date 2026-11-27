import Image from "next/image";
import Link from "next/link";
import { Gift } from "lucide-react";
import type { PublicCategory } from "./types";

export default function CategoryCard({
  category,
}: {
  category: PublicCategory;
}) {
  const count = category._count?.products;
  return (
    <Link
      href={`/products?category=${encodeURIComponent(category.slug)}`}
      className="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-primary/10">
        {category.image ? (
          <Image
            src={category.image}
            alt={category.name}
            width={800}
            height={500}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-primary/10">
            <Gift className="h-12 w-12 text-primary" />
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="text-base font-semibold text-navy group-hover:text-primary">
          {category.name}
        </h3>
        {category.description && (
          <p className="mt-1 line-clamp-2 text-sm text-slate-500">
            {category.description}
          </p>
        )}
        {typeof count === "number" && (
          <p className="mt-2 text-xs font-medium text-slate-500">
            {count} {count === 1 ? "product" : "products"}
          </p>
        )}
      </div>
    </Link>
  );
}
