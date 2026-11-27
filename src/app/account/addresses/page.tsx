"use client";

import { useActionState, useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  Check,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  addAddress,
  deleteAddress,
  listAddresses,
  setDefaultAddress,
  updateAddress,
  type AddressData,
} from "./actions";

export const dynamic = "force-dynamic";

const EMPTY_FORM = {
  title: "",
  fullName: "",
  phone: "",
  division: "",
  district: "",
  upazila: "",
  area: "",
  street: "",
  postalCode: "",
  instructions: "",
};

type FormValues = typeof EMPTY_FORM;

function formValuesOf(a: AddressData): FormValues {
  return {
    title: a.title,
    fullName: a.fullName,
    phone: a.phone,
    division: a.division,
    district: a.district,
    upazila: a.upazila,
    area: a.area,
    street: a.street,
    postalCode: a.postalCode ?? "",
    instructions: a.instructions ?? "",
  };
}

export default function AddressesPage() {
  const [addresses, setAddresses] = useState<AddressData[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<FormValues>(EMPTY_FORM);
  const [isDefaultChecked, setIsDefaultChecked] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [addState, addAction, addPending] = useActionState(addAddress, null);
  const [editState, editAction, editPending] = useActionState(
    updateAddress,
    null,
  );
  const isPending = addPending || editPending;
  const formState = editingId ? editState : addState;

  async function refresh() {
    const rows = await listAddresses();
    setAddresses(rows);
    setLoaded(true);
  }

  useEffect(() => {
    refresh().catch(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (formState?.ok) {
      toast.success(formState.message ?? "Address saved.");
      setFormOpen(false);
      setEditingId(null);
      setFormValues(EMPTY_FORM);
      setIsDefaultChecked(false);
      refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formState]);

  function openAdd() {
    setEditingId(null);
    setFormValues(EMPTY_FORM);
    setIsDefaultChecked(addresses.length === 0);
    setFormOpen(true);
  }

  function openEdit(address: AddressData) {
    setEditingId(address.id);
    setFormValues(formValuesOf(address));
    setIsDefaultChecked(address.isDefault);
    setFormOpen(true);
  }

  function setField(field: keyof FormValues, value: string) {
    setFormValues((v) => ({ ...v, [field]: value }));
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this address? This cannot be undone.")) return;
    setBusyId(id);
    const result = await deleteAddress(id);
    setBusyId(null);
    if (result.ok) {
      toast.success("Address deleted.");
      refresh();
    } else {
      toast.error(result.error ?? "Could not delete the address.");
    }
  }

  async function handleSetDefault(id: string) {
    setBusyId(id);
    const result = await setDefaultAddress(id);
    setBusyId(null);
    if (result.ok) {
      toast.success("Default address updated.");
      refresh();
    } else {
      toast.error(result.error ?? "Could not set the default address.");
    }
  }

  const field = (
    id: keyof FormValues,
    label: string,
    opts?: { required?: boolean; type?: string; placeholder?: string },
  ) => (
    <div className="space-y-2">
      <Label htmlFor={`addr-${id}`}>{label}</Label>
      <Input
        id={`addr-${id}`}
        name={id}
        type={opts?.type ?? "text"}
        value={formValues[id]}
        onChange={(e) => setField(id, e.target.value)}
        placeholder={opts?.placeholder}
        required={opts?.required ?? true}
      />
    </div>
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy sm:text-3xl">
            Saved Addresses
          </h1>
          <p className="mt-1 text-slate-600">
            Manage the delivery addresses saved to your account.
          </p>
        </div>
        {!formOpen && (
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4" />
            Add Address
          </Button>
        )}
      </div>

      {formOpen && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>{editingId ? "Edit address" : "Add a new address"}</CardTitle>
            <CardDescription>
              Only one address can be the default — setting a new default
              replaces the old one.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={editingId ? editAction : addAction} className="space-y-4">
              {editingId && <input type="hidden" name="id" value={editingId} />}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {field("title", "Address title", { placeholder: "Home, Office…" })}
                {field("fullName", "Recipient full name")}
                {field("phone", "Phone number", { type: "tel", placeholder: "01XXXXXXXXX" })}
                {field("division", "Division", { placeholder: "Chattogram" })}
                {field("district", "District", { placeholder: "Chattogram" })}
                {field("upazila", "Upazila", { placeholder: "Kotwali" })}
                {field("area", "Area", { placeholder: "Agrabad" })}
                {field("postalCode", "Postal code", { required: false, placeholder: "4100" })}
              </div>
              <div className="space-y-2">
                <Label htmlFor="addr-street">Street / house details</Label>
                <Input
                  id="addr-street"
                  name="street"
                  value={formValues.street}
                  onChange={(e) => setField("street", e.target.value)}
                  placeholder="House, road, landmark"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="addr-instructions">
                  Delivery instructions{" "}
                  <span className="font-normal text-slate-400">(optional)</span>
                </Label>
                <Textarea
                  id="addr-instructions"
                  name="instructions"
                  value={formValues.instructions}
                  onChange={(e) => setField("instructions", e.target.value)}
                  placeholder="Anything the delivery person should know"
                  rows={3}
                />
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-navy">
                <input
                  type="checkbox"
                  name="isDefault"
                  checked={isDefaultChecked}
                  onChange={(e) => setIsDefaultChecked(e.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
                Set as my default address
              </label>

              {formState?.error && (
                <p
                  role="alert"
                  className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
                >
                  {formState.error}
                </p>
              )}

              <div className="flex flex-wrap gap-3">
                <Button type="submit" disabled={isPending}>
                  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingId ? "Save changes" : "Add address"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setFormOpen(false);
                    setEditingId(null);
                  }}
                >
                  <X className="h-4 w-4" />
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {!loaded ? (
        <p className="mt-6 flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading addresses…
        </p>
      ) : addresses.length === 0 ? (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <MapPin className="mx-auto h-10 w-10 text-slate-300" />
          <h2 className="mt-3 text-lg font-bold text-navy">No saved addresses</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">
            Add your home or office address so checkout is faster next time.
          </p>
          <Button className="mt-5" onClick={openAdd}>
            <Plus className="h-4 w-4" />
            Add Your First Address
          </Button>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {addresses.map((address) => (
            <div
              key={address.id}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="flex items-center gap-2 text-base font-bold text-navy">
                  {address.title}
                  {address.isDefault && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                      <Star className="h-3 w-3" />
                      Default
                    </span>
                  )}
                </h2>
              </div>
              <p className="mt-2 text-sm font-medium text-navy">
                {address.fullName} · {address.phone}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                {address.street}, {address.area}, {address.upazila},{" "}
                {address.district}, {address.division}
                {address.postalCode ? ` — ${address.postalCode}` : ""}
              </p>
              {address.instructions && (
                <p className="mt-1 text-xs text-slate-500">
                  Note: {address.instructions}
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openEdit(address)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Button>
                {!address.isDefault && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busyId === address.id}
                    onClick={() => handleSetDefault(address.id)}
                  >
                    <Check className="h-3.5 w-3.5" />
                    Set as default
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busyId === address.id}
                  onClick={() => handleDelete(address.id)}
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
