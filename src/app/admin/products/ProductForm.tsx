"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { slugify } from "@/lib/utils";
import { createProduct, updateProduct } from "./actions";

export type ProductFormProduct = {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  discountPrice: number | null;
  sku: string | null;
  stock: number;
  status: string;
  featured: boolean;
  categoryId: string;
  images: { url: string }[];
};

export type CategoryOption = { id: string; name: string };

type FieldErrors = Record<string, string[]>;

export function ProductForm({
  product,
  categories,
  onClose,
}: {
  product?: ProductFormProduct | null;
  categories: CategoryOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isEdit = Boolean(product);

  const [name, setName] = useState(product?.name ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(product));
  const [description, setDescription] = useState(product?.description ?? "");
  const [price, setPrice] = useState(product ? String(product.price) : "");
  const [discountPrice, setDiscountPrice] = useState(
    product?.discountPrice != null ? String(product.discountPrice) : ""
  );
  const [sku, setSku] = useState(product?.sku ?? "");
  const [stock, setStock] = useState(product ? String(product.stock) : "0");
  const [status, setStatus] = useState(product?.status ?? "available");
  const [categoryId, setCategoryId] = useState(
    product?.categoryId ?? categories[0]?.id ?? ""
  );
  const [featured, setFeatured] = useState(product?.featured ?? false);
  const [images, setImages] = useState<string[]>(
    (product?.images ?? []).map((img) => img.url)
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  function handleNameChange(value: string) {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  function moveImage(index: number, direction: -1 | 1) {
    const next = [...images];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setImages(next);
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    const uploaded: string[] = [];
    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append("file", file);
      try {
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        const data: { url?: string; error?: string } = await res.json();
        if (!res.ok || !data.url) {
          toast.error(data.error ?? `Could not upload ${file.name}`);
        } else {
          uploaded.push(data.url);
        }
      } catch {
        toast.error(`Could not upload ${file.name}`);
      }
    }
    if (uploaded.length > 0) setImages((prev) => [...prev, ...uploaded]);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setErrors({});
    setFormError(null);

    const formData = new FormData();
    formData.set("name", name);
    formData.set("slug", slug);
    formData.set("description", description);
    formData.set("price", price);
    formData.set("discountPrice", discountPrice);
    formData.set("sku", sku);
    formData.set("stock", stock);
    formData.set("status", status);
    formData.set("categoryId", categoryId);
    formData.set("featured", featured ? "true" : "false");
    formData.set("images", JSON.stringify(images));

    const result = isEdit
      ? await updateProduct(product!.id, formData)
      : await createProduct(formData);

    setSaving(false);
    if (!result.success) {
      if (result.errors) setErrors(result.errors);
      if (result.error) setFormError(result.error);
      if (!result.errors && !result.error) {
        toast.error("Could not save the product. Please try again.");
      }
      return;
    }
    toast.success(isEdit ? "Product updated." : "Product created.");
    router.refresh();
    onClose();
  }

  const fieldError = (field: string) => errors[field]?.[0];

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit product" : "Add product"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the product details below."
              : "Fill in the details for the new product."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="product-name">Name *</Label>
              <Input
                id="product-name"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Gift mug"
              />
              {fieldError("name") && (
                <p className="text-xs text-red-600">{fieldError("name")}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-slug">Slug *</Label>
              <Input
                id="product-slug"
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(slugify(e.target.value));
                }}
                placeholder="gift-mug"
              />
              {fieldError("slug") && (
                <p className="text-xs text-red-600">{fieldError("slug")}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="product-description">Description</Label>
            <Textarea
              id="product-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description of the product"
              rows={3}
            />
            {fieldError("description") && (
              <p className="text-xs text-red-600">{fieldError("description")}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="product-category">Category *</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger id="product-category">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldError("categoryId") && (
                <p className="text-xs text-red-600">{fieldError("categoryId")}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-status">Status *</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="product-status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="out_of_stock">Out of stock</SelectItem>
                  <SelectItem value="hidden">Hidden</SelectItem>
                </SelectContent>
              </Select>
              {fieldError("status") && (
                <p className="text-xs text-red-600">{fieldError("status")}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="product-price">Price (৳) *</Label>
              <Input
                id="product-price"
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="250"
              />
              {fieldError("price") && (
                <p className="text-xs text-red-600">{fieldError("price")}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-discount">Discount price (৳)</Label>
              <Input
                id="product-discount"
                type="number"
                min="0"
                step="0.01"
                value={discountPrice}
                onChange={(e) => setDiscountPrice(e.target.value)}
                placeholder="Optional"
              />
              {fieldError("discountPrice") && (
                <p className="text-xs text-red-600">{fieldError("discountPrice")}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-stock">Stock *</Label>
              <Input
                id="product-stock"
                type="number"
                min="0"
                step="1"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
              />
              {fieldError("stock") && (
                <p className="text-xs text-red-600">{fieldError("stock")}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="product-sku">SKU</Label>
            <Input
              id="product-sku"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="Optional"
            />
            {fieldError("sku") && (
              <p className="text-xs text-red-600">{fieldError("sku")}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="product-featured"
              checked={featured}
              onCheckedChange={(v) => setFeatured(v === true)}
            />
            <Label htmlFor="product-featured">Featured product</Label>
          </div>

          <div className="space-y-2">
            <Label>Images</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              {uploading ? "Uploading…" : "Upload images"}
            </Button>
            <p className="text-xs text-slate-500">
              First image is the main image. Use the arrows to reorder.
            </p>
            {images.length > 0 && (
              <div className="flex flex-wrap gap-3">
                {images.map((url, index) => (
                  <div key={`${url}-${index}`} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`Product image ${index + 1}`}
                      className="h-20 w-20 rounded-md border object-cover"
                    />
                    {index === 0 && (
                      <span className="absolute left-1 top-1 rounded bg-[#2563EB] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        Main
                      </span>
                    )}
                    <div className="absolute -right-2 -top-2 flex gap-1">
                      <button
                        type="button"
                        aria-label="Remove image"
                        onClick={() =>
                          setImages((prev) => prev.filter((_, i) => i !== index))
                        }
                        className="rounded-full bg-white p-1 shadow ring-1 ring-slate-200 hover:bg-red-50 hover:text-red-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="mt-1 flex justify-center gap-1">
                      <button
                        type="button"
                        aria-label="Move image up"
                        disabled={index === 0}
                        onClick={() => moveImage(index, -1)}
                        className="rounded bg-slate-100 p-1 disabled:opacity-40"
                      >
                        <ChevronUp className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        aria-label="Move image down"
                        disabled={index === images.length - 1}
                        onClick={() => moveImage(index, 1)}
                        className="rounded bg-slate-100 p-1 disabled:opacity-40"
                      >
                        <ChevronDown className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {formError && (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {formError}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || uploading}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {saving ? "Saving…" : isEdit ? "Save changes" : "Create product"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
