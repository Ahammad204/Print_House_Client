"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { adjustStock } from "./actions";

export function AdjustStockButton({
  productId,
  productName,
  currentStock,
}: {
  productId: string;
  productName: string;
  currentStock: number;
}) {
  const [open, setOpen] = useState(false);
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("Restock");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const formData = new FormData();
    formData.set("productId", productId);
    formData.set("delta", delta);
    formData.set("reason", reason);
    startTransition(async () => {
      const result = await adjustStock(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Stock updated");
      setOpen(false);
      setDelta("");
      setReason("Restock");
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <PackagePlus className="mr-1.5 h-4 w-4" />
        Adjust Stock
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust stock — {productName}</DialogTitle>
            <DialogDescription>
              Current stock: {currentStock}. Use a positive number to restock
              and a negative number to reduce stock. Stock can never go below
              0.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="delta">Quantity change</Label>
              <Input
                id="delta"
                inputMode="numeric"
                value={delta}
                onChange={(e) => setDelta(e.target.value)}
                placeholder="e.g. 10 or -3"
                required
              />
              {delta && !Number.isNaN(Number(delta)) && (
                <p className="text-xs text-slate-500">
                  New stock will be {currentStock + Math.trunc(Number(delta))}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Reason</Label>
              <Input
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Restock"
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : "Save Adjustment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
