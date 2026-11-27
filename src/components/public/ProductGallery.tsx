"use client";

import { useState } from "react";
import Image from "next/image";

export default function ProductGallery({
  images,
  productName,
}: {
  images: { id: string; url: string; alt?: string | null }[];
  productName: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = images[activeIndex] ?? images[0];

  if (!active) {
    return (
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-slate-100">
        <Image
          src="/images/products/gift-box.svg"
          alt={productName}
          width={800}
          height={600}
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  return (
    <div>
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-slate-100">
        <Image
          key={active.id}
          src={active.url}
          alt={active.alt ?? productName}
          width={1000}
          height={750}
          className="h-full w-full object-cover"
        />
      </div>
      {images.length > 1 && (
        <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
          {images.map((image, index) => (
            <button
              key={image.id}
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-label={`View image ${index + 1}`}
              className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border-2 transition ${
                index === activeIndex
                  ? "border-primary"
                  : "border-transparent opacity-70 hover:opacity-100"
              }`}
            >
              <Image
                src={image.url}
                alt={image.alt ?? `${productName} thumbnail ${index + 1}`}
                width={160}
                height={160}
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
