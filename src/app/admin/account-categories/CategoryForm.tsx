"use client";

import { useEffect, useState, useTransition } from "react";
import toast from "react-hot-toast";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createAccountCategory,
  deleteAccountCategory,
  updateAccountCategory,
} from "./actions";

export type AccountCategoryData = {
  id: string;
  name: string;
  type: "income" | "expense";
  description: string | null;
  status: "active" | "inactive";
};

function CategoryForm({
  category,
  open,
  onOpenChange,
}: {
  category?: AccountCategoryData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isEdit = Boolean(category);
  const [name, setName] = useState(category?.name ?? "");
  const [type, setType] = useState<"income" | "expense">(
    category?.type ?? "income"
  );
  const [description, setDescription] = useState(category?.description ?? "");
  const [status, setStatus] = useState<"active" | "inactive">(
    category?.status ?? "active"
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setName(category?.name ?? "");
    setType(category?.type ?? "income");
    setDescription(category?.description ?? "");
    setStatus(category?.status ?? "active");
    setError(null);
  }, [open, category]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const formData = new FormData();
    formData.set("name", name);
    formData.set("type", type);
    formData.set("description", description);
    formData.set("status", status);

    startTransition(async () => {
      const result = isEdit
        ? await updateAccountCategory(category!.id, formData)
        : await createAccountCategory(formData);
      if (!result.success) {
        setError(result.error);
        return;
      }
      toast.success(isEdit ? "Category updated" : "Category added");
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Category" : "Add Category"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the account category."
              : "Add a new income or expense category for daily accounts."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cat-name">Name</Label>
            <Input
              id="cat-name"
              type="text"
              placeholder="e.g. Gift Sales, Printing Paper"
              autoFocus
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cat-type">Type</Label>
              <Select
                value={type}
                onValueChange={(v) => setType(v as "income" | "expense")}
              >
                <SelectTrigger id="cat-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-status">Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as "active" | "inactive")}
              >
                <SelectTrigger id="cat-status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cat-description">Description (optional)</Label>
            <Textarea
              id="cat-description"
              placeholder="What belongs in this category?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {error && (
            <p className="text-sm font-medium text-red-600">{error}</p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : isEdit ? "Save Changes" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AddCategoryButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        Add Category
      </Button>
      <CategoryForm open={open} onOpenChange={setOpen} />
    </>
  );
}

export function EditCategoryButton({
  category,
}: {
  category: AccountCategoryData;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="mr-1 h-3 w-3" />
        Edit
      </Button>
      <CategoryForm
        category={category}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}

export function DeleteCategoryButton({
  id,
  name,
}: {
  id: string;
  name: string;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteAccountCategory(id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Category deleted");
      setOpen(false);
    });
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="mr-1 h-3 w-3" />
        Delete
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete category?</DialogTitle>
            <DialogDescription>
              This will permanently delete the “{name}” category. Categories
              with transactions cannot be deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isPending}
            >
              {isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default CategoryForm;
