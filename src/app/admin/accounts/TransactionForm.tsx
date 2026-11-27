"use client";

import { useEffect, useState, useTransition } from "react";
import toast from "react-hot-toast";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createTransaction,
  deleteTransaction,
  updateTransaction,
} from "./actions";

export type CategoryOption = {
  id: string;
  name: string;
  type: "income" | "expense";
  status: string;
};

export type TransactionData = {
  id: string;
  type: "income" | "expense";
  categoryId: string;
  amount: number;
  description: string;
  date: string; // YYYY-MM-DD
  paymentMethod: "Cash" | "bKash" | "Nagad" | "Bank" | "Other";
  reference: string | null;
};

const PAYMENT_METHODS = ["Cash", "bKash", "Nagad", "Bank", "Other"] as const;

function dhakaToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" });
}

function TransactionForm({
  categories,
  transaction,
  open,
  onOpenChange,
}: {
  categories: CategoryOption[];
  transaction?: TransactionData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isEdit = Boolean(transaction);
  const [type, setType] = useState<"income" | "expense">(
    transaction?.type ?? "income"
  );
  const [categoryId, setCategoryId] = useState(transaction?.categoryId ?? "");
  const [amount, setAmount] = useState(
    transaction ? String(transaction.amount) : ""
  );
  const [description, setDescription] = useState(
    transaction?.description ?? ""
  );
  const [date, setDate] = useState(transaction?.date ?? dhakaToday());
  const [paymentMethod, setPaymentMethod] = useState<string>(
    transaction?.paymentMethod ?? "Cash"
  );
  const [reference, setReference] = useState(transaction?.reference ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Reset the form whenever the dialog opens (fresh add, or prefilled edit).
  useEffect(() => {
    if (!open) return;
    setType(transaction?.type ?? "income");
    setCategoryId(transaction?.categoryId ?? "");
    setAmount(transaction ? String(transaction.amount) : "");
    setDescription(transaction?.description ?? "");
    setDate(transaction?.date ?? dhakaToday());
    setPaymentMethod(transaction?.paymentMethod ?? "Cash");
    setReference(transaction?.reference ?? "");
    setError(null);
  }, [open, transaction]);

  // Only categories whose type matches the selected transaction type.
  const matchingCategories = categories.filter(
    (c) => c.type === type && c.status === "active"
  );

  // If the selected category does not belong to the new type, clear it.
  useEffect(() => {
    if (
      categoryId &&
      !matchingCategories.some((c) => c.id === categoryId)
    ) {
      setCategoryId("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const formData = new FormData();
    formData.set("type", type);
    formData.set("categoryId", categoryId);
    formData.set("amount", amount);
    formData.set("description", description);
    formData.set("date", date);
    formData.set("paymentMethod", paymentMethod);
    formData.set("reference", reference);

    startTransition(async () => {
      const result = isEdit
        ? await updateTransaction(transaction!.id, formData)
        : await createTransaction(formData);
      if (!result.success) {
        setError(result.error);
        return;
      }
      toast.success(
        isEdit ? "Transaction updated" : "Transaction added"
      );
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Transaction" : "Add Transaction"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the transaction details below."
              : "Record a new income or expense. Keep it quick — type, category, amount."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type toggle */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={type === "income" ? "default" : "outline"}
              className={
                type === "income"
                  ? "bg-green-600 hover:bg-green-700"
                  : "text-green-700 border-green-200 hover:bg-green-50"
              }
              onClick={() => setType("income")}
            >
              Income
            </Button>
            <Button
              type="button"
              variant={type === "expense" ? "default" : "outline"}
              className={
                type === "expense"
                  ? "bg-red-600 hover:bg-red-700"
                  : "text-red-700 border-red-200 hover:bg-red-50"
              }
              onClick={() => setType("expense")}
            >
              Expense
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tx-amount">Amount (৳)</Label>
            <Input
              id="tx-amount"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              placeholder="0.00"
              autoFocus
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tx-category">Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger id="tx-category">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {matchingCategories.length === 0 && (
                  <SelectItem value="__none" disabled>
                    No {type} categories — add one in Account Categories
                  </SelectItem>
                )}
                {matchingCategories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tx-description">Description</Label>
            <Input
              id="tx-description"
              type="text"
              placeholder="e.g. Gift box sale, printing paper purchase"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tx-date">Date</Label>
              <Input
                id="tx-date"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tx-payment">Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger id="tx-payment">
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tx-reference">Reference / Note (optional)</Label>
            <Input
              id="tx-reference"
              type="text"
              placeholder="e.g. bKash TrxID, invoice no."
              value={reference}
              onChange={(e) => setReference(e.target.value)}
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

export function AddTransactionButton({
  categories,
}: {
  categories: CategoryOption[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        Add Transaction
      </Button>
      <TransactionForm
        categories={categories}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}

export function EditTransactionButton({
  categories,
  transaction,
}: {
  categories: CategoryOption[];
  transaction: TransactionData;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="mr-1 h-3 w-3" />
        Edit
      </Button>
      <TransactionForm
        categories={categories}
        transaction={transaction}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}

export function DeleteTransactionButton({
  id,
  description,
}: {
  id: string;
  description: string;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteTransaction(id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Transaction deleted");
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
            <DialogTitle>Delete transaction?</DialogTitle>
            <DialogDescription>
              This will permanently delete “{description}”. This cannot be
              undone.
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

export default TransactionForm;
