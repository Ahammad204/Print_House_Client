"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Loader2, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { slugify } from "@/lib/utils";
import { createCategory, deleteCategory, updateCategory } from "./actions";

export type CategoryFormData = {
  id: string;
  name: string;
  slug: string;
  description: string;
  image: string | null;
  status: string;
  order: number;
};

export type CategoryRow = CategoryFormData & { productCount: number };

type FieldErrors = Record<string, string[]>;

export function CategoryForm({
  category,
  onClose,
}: {
  category?: CategoryFormData | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isEdit = Boolean(category);

  const [name, setName] = useState(category?.name ?? "");
  const [slug, setSlug] = useState(category?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(category));
  const [description, setDescription] = useState(category?.description ?? "");
  const [image, setImage] = useState(category?.image ?? "");
  const [status, setStatus] = useState(category?.status ?? "active");
  const [order, setOrder] = useState(category ? String(category.order) : "0");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  function handleNameChange(value: string) {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  async function handleFile(file: File | null) {
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data: { url?: string; error?: string } = await res.json();
      if (!res.ok || !data.url) {
        toast.error(data.error ?? "Could not upload the image.");
      } else {
        setImage(data.url);
      }
    } catch {
      toast.error("Could not upload the image.");
    }
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
    formData.set("image", image);
    formData.set("status", status);
    formData.set("order", order);

    const result = isEdit
      ? await updateCategory(category!.id, formData)
      : await createCategory(formData);

    setSaving(false);
    if (!result.success) {
      if (result.errors) setErrors(result.errors);
      if (result.error) setFormError(result.error);
      if (!result.errors && !result.error) {
        toast.error("Could not save the category. Please try again.");
      }
      return;
    }
    toast.success(isEdit ? "Category updated." : "Category created.");
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
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit category" : "Add category"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the category details below."
              : "Fill in the details for the new category."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="category-name">Name *</Label>
              <Input
                id="category-name"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Gift Items"
              />
              {fieldError("name") && (
                <p className="text-xs text-red-600">{fieldError("name")}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="category-slug">Slug *</Label>
              <Input
                id="category-slug"
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(slugify(e.target.value));
                }}
                placeholder="gift-items"
              />
              {fieldError("slug") && (
                <p className="text-xs text-red-600">{fieldError("slug")}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category-description">Description</Label>
            <Textarea
              id="category-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description of the category"
              rows={3}
            />
            {fieldError("description") && (
              <p className="text-xs text-red-600">{fieldError("description")}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Image</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
            {image ? (
              <div className="relative w-fit">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image}
                  alt={name || "Category image"}
                  className="h-24 w-24 rounded-md border object-cover"
                />
                <button
                  type="button"
                  aria-label="Remove image"
                  onClick={() => setImage("")}
                  className="absolute -right-2 -top-2 rounded-full bg-white p-1 shadow ring-1 ring-slate-200 hover:bg-red-50 hover:text-red-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
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
                {uploading ? "Uploading…" : "Upload image"}
              </Button>
            )}
            {fieldError("image") && (
              <p className="text-xs text-red-600">{fieldError("image")}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="category-status">Status *</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="category-status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              {fieldError("status") && (
                <p className="text-xs text-red-600">{fieldError("status")}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="category-order">Order</Label>
              <Input
                id="category-order"
                type="number"
                min="0"
                step="1"
                value={order}
                onChange={(e) => setOrder(e.target.value)}
              />
              {fieldError("order") && (
                <p className="text-xs text-red-600">{fieldError("order")}</p>
              )}
            </div>
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
              {saving ? "Saving…" : isEdit ? "Save changes" : "Create category"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CategoryTable({ categories }: { categories: CategoryRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CategoryRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const result = await deleteCategory(deleteTarget.id);
    setDeleting(false);
    if (result.success) {
      toast.success("Category deleted.");
      setDeleteTarget(null);
      router.refresh();
    } else {
      toast.error(result.error ?? "Could not delete the category.");
      setDeleteTarget(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setAdding(true)}>
          <Plus className="mr-2 h-4 w-4" /> Add Category
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Products</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-slate-500">
                  No categories found. Add a category to get started.
                </TableCell>
              </TableRow>
            ) : (
              categories.map((category) => (
                <TableRow key={category.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {category.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={category.image}
                          alt={category.name}
                          className="h-12 w-12 shrink-0 rounded-md border object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border bg-slate-100 text-xs text-slate-400">
                          No image
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900">{category.name}</p>
                        {category.description && (
                          <p className="max-w-[260px] truncate text-xs text-slate-500">
                            {category.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-500">{category.slug}</TableCell>
                  <TableCell>
                    <Badge
                      className={
                        category.status === "active"
                          ? "bg-green-100 text-green-800 hover:bg-green-100"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-100"
                      }
                    >
                      {category.status === "active" ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>{category.order}</TableCell>
                  <TableCell>{category.productCount}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditing(category)}
                        aria-label={`Edit ${category.name}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteTarget(category)}
                        aria-label={`Delete ${category.name}`}
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {adding && <CategoryForm category={null} onClose={() => setAdding(false)} />}
      {editing && <CategoryForm category={editing} onClose={() => setEditing(null)} />}

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete category?</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? deleteTarget.productCount > 0
                  ? `“${deleteTarget.name}” has ${deleteTarget.productCount} product(s). Delete is blocked while products use this category — reassign them first.`
                  : `“${deleteTarget.name}” will be permanently deleted. This cannot be undone.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting || (deleteTarget?.productCount ?? 0) > 0}
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
