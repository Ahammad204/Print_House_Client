"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Pencil, Plus, Search, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
import { Badge } from "@/components/ui/badge";
import { formatBDT } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { ProductForm, type CategoryOption, type ProductFormProduct } from "./ProductForm";
import { bulkDeleteProducts, deleteProduct, toggleFeatured } from "./actions";

export type ProductRow = ProductFormProduct & { categoryName: string };

const STATUS_LABELS: Record<string, string> = {
  available: "Available",
  out_of_stock: "Out of stock",
  hidden: "Hidden",
};

function statusBadgeClass(status: string): string {
  switch (status) {
    case "available":
      return "bg-green-100 text-green-800 hover:bg-green-100";
    case "out_of_stock":
      return "bg-red-100 text-red-800 hover:bg-red-100";
    default:
      return "bg-slate-100 text-slate-700 hover:bg-slate-100";
  }
}

export function ProductTable({
  products,
  categories,
  total,
  totalPages,
  page,
  filters,
}: {
  products: ProductRow[];
  categories: CategoryOption[];
  total: number;
  totalPages: number;
  page: number;
  filters: { q: string; category: string; status: string };
}) {
  const router = useRouter();
  const [search, setSearch] = useState(filters.q);
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<ProductRow | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProductRow | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function pushQuery(next: { q?: string; category?: string; status?: string; page?: number }) {
    const params = new URLSearchParams();
    const q = next.q !== undefined ? next.q : filters.q;
    const category = next.category !== undefined ? next.category : filters.category;
    const status = next.status !== undefined ? next.status : filters.status;
    const pageValue = next.page !== undefined ? next.page : 1;
    if (q) params.set("q", q);
    if (category && category !== "all") params.set("category", category);
    if (status && status !== "all") params.set("status", status);
    if (pageValue > 1) params.set("page", String(pageValue));
    router.push(`/admin/products?${params.toString()}`);
  }

  function pageHref(targetPage: number): string {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.category && filters.category !== "all") params.set("category", filters.category);
    if (filters.status && filters.status !== "all") params.set("status", filters.status);
    if (targetPage > 1) params.set("page", String(targetPage));
    const query = params.toString();
    return query ? `/admin/products?${query}` : "/admin/products";
  }

  const allSelected = products.length > 0 && selected.length === products.length;

  function toggleSelect(id: string, checked: boolean) {
    setSelected((prev) =>
      checked ? [...prev, id] : prev.filter((item) => item !== id)
    );
  }

  function toggleSelectAll(checked: boolean) {
    setSelected(checked ? products.map((p) => p.id) : []);
  }

  async function handleToggleFeatured(product: ProductRow) {
    const result = await toggleFeatured(product.id, !product.featured);
    if (result.success) {
      toast.success(product.featured ? "Removed from featured." : "Marked as featured.");
      router.refresh();
    } else {
      toast.error(result.error ?? "Could not update featured status.");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const result = await deleteProduct(deleteTarget.id);
    setDeleting(false);
    if (result.success) {
      toast.success("Product deleted.");
      setSelected((prev) => prev.filter((id) => id !== deleteTarget.id));
      setDeleteTarget(null);
      router.refresh();
    } else {
      toast.error(result.error ?? "Could not delete the product.");
    }
  }

  async function handleBulkDelete() {
    setDeleting(true);
    const result = await bulkDeleteProducts(selected);
    setDeleting(false);
    if (result.success) {
      toast.success(`${selected.length} product(s) deleted.`);
      setSelected([]);
      setBulkDeleteOpen(false);
      router.refresh();
    } else {
      toast.error(result.error ?? "Could not delete the selected products.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <form
          className="flex flex-1 flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            pushQuery({ q: search, page: 1 });
          }}
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, SKU or description…"
              className="bg-white pl-9"
            />
          </div>
          <Select
            value={filters.category || "all"}
            onValueChange={(v) => pushQuery({ category: v, page: 1 })}
          >
            <SelectTrigger className="w-full bg-white sm:w-48">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.status || "all"}
            onValueChange={(v) => pushQuery({ status: v, page: 1 })}
          >
            <SelectTrigger className="w-full bg-white sm:w-44">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="out_of_stock">Out of stock</SelectItem>
              <SelectItem value="hidden">Hidden</SelectItem>
            </SelectContent>
          </Select>
          <Button type="submit">Search</Button>
        </form>
        <Button onClick={() => setAdding(true)}>
          <Plus className="mr-2 h-4 w-4" /> Add Product
        </Button>
      </div>

      {selected.length > 0 && (
        <div className="flex items-center justify-between rounded-lg border bg-white px-4 py-2">
          <p className="text-sm font-medium text-slate-700">
            {selected.length} selected
          </p>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setBulkDeleteOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" /> Delete selected
          </Button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={(v) => toggleSelectAll(v === true)}
                  aria-label="Select all products on this page"
                />
              </TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Featured</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-sm text-slate-500">
                  No products found. Try a different search or add a new product.
                </TableCell>
              </TableRow>
            ) : (
              products.map((product) => {
                const thumb = product.images[0]?.url;
                return (
                  <TableRow key={product.id}>
                    <TableCell>
                      <Checkbox
                        checked={selected.includes(product.id)}
                        onCheckedChange={(v) => toggleSelect(product.id, v === true)}
                        aria-label={`Select ${product.name}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={thumb}
                            alt={product.name}
                            className="h-12 w-12 shrink-0 rounded-md border object-cover"
                          />
                        ) : (
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border bg-slate-100 text-xs text-slate-400">
                            No image
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-900">
                            {product.name}
                          </p>
                          <p className="truncate text-xs text-slate-500">{product.slug}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{product.categoryName}</TableCell>
                    <TableCell>
                      <div>
                        {product.discountPrice != null ? (
                          <>
                            <p className="font-medium text-slate-900">
                              {formatBDT(product.discountPrice)}
                            </p>
                            <p className="text-xs text-slate-400 line-through">
                              {formatBDT(product.price)}
                            </p>
                          </>
                        ) : (
                          <p className="font-medium text-slate-900">
                            {formatBDT(product.price)}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{product.stock}</TableCell>
                    <TableCell>
                      <Badge className={statusBadgeClass(product.status)}>
                        {STATUS_LABELS[product.status] ?? product.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => handleToggleFeatured(product)}
                        aria-label={
                          product.featured ? "Remove from featured" : "Mark as featured"
                        }
                        title={product.featured ? "Featured — click to remove" : "Click to feature"}
                        className={cn(
                          "rounded-md p-1.5",
                          product.featured
                            ? "text-amber-500 hover:bg-amber-50"
                            : "text-slate-300 hover:bg-slate-100 hover:text-amber-500"
                        )}
                      >
                        <Star
                          className="h-5 w-5"
                          fill={product.featured ? "currentColor" : "none"}
                        />
                      </button>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditing(product)}
                          aria-label={`Edit ${product.name}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteTarget(product)}
                          aria-label={`Delete ${product.name}`}
                          className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col items-center justify-between gap-2 text-sm text-slate-500 sm:flex-row">
        <p>
          Showing {products.length} of {total} product{total === 1 ? "" : "s"}
        </p>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" disabled={page <= 1}>
              <Link href={pageHref(page - 1)}>Previous</Link>
            </Button>
            <span>
              Page {page} of {totalPages}
            </span>
            <Button asChild variant="outline" size="sm" disabled={page >= totalPages}>
              <Link href={pageHref(page + 1)}>Next</Link>
            </Button>
          </div>
        )}
      </div>

      {adding && (
        <ProductForm
          product={null}
          categories={categories}
          onClose={() => setAdding(false)}
        />
      )}
      {editing && (
        <ProductForm
          product={editing}
          categories={categories}
          onClose={() => setEditing(null)}
        />
      )}

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete product?</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `“${deleteTarget.name}” will be permanently deleted. This cannot be undone.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {selected.length} product(s)?</DialogTitle>
            <DialogDescription>
              The selected products will be permanently deleted. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete selected"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
