"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { OrderSettings } from "@/lib/order-settings";
import { updateOrderSettings } from "./actions";

function Toggle({
  name,
  label,
  hint,
  defaultChecked,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultChecked: boolean;
}) {
  const [checked, setChecked] = useState(defaultChecked);
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3">
      {/* Hidden "false" first: when the box is checked the later "true"
          value wins in FormData; when unchecked only "false" is sent. */}
      <input type="hidden" name={name} value="false" />
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => setChecked(v === true)}
        name={name}
        value="true"
      />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="block text-xs text-slate-500">{hint}</span>}
      </span>
    </label>
  );
}

export default function OrderSettingsForm({
  settings,
}: {
  settings: OrderSettings;
}) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await updateOrderSettings(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Order settings saved");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Features */}
      <Card>
        <CardHeader>
          <CardTitle>Ordering Features</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Toggle
              name="enableOnlineOrdering"
              label="Online Ordering"
              hint="Turn the whole online ordering flow on or off."
              defaultChecked={settings.enableOnlineOrdering}
            />
            <Toggle
              name="enableGuestCheckout"
              label="Guest Checkout"
              hint="Allow orders without a customer account."
              defaultChecked={settings.enableGuestCheckout}
            />
            <Toggle
              name="enableRegistration"
              label="Customer Registration"
              hint="Allow new customers to create an account."
              defaultChecked={settings.enableRegistration}
            />
            <Toggle
              name="enableCustomerLogin"
              label="Customer Login"
              hint="Allow existing customers to log in."
              defaultChecked={settings.enableCustomerLogin}
            />
          </div>
          <div className="max-w-xs space-y-2">
            <Label htmlFor="minOrderAmount">Minimum Order Amount (৳)</Label>
            <Input
              id="minOrderAmount"
              name="minOrderAmount"
              type="number"
              min={0}
              step="0.01"
              defaultValue={settings.minOrderAmount}
            />
            <p className="text-xs text-slate-500">
              0 means no minimum order amount.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Delivery */}
      <Card>
        <CardHeader>
          <CardTitle>Delivery</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Toggle
              name="enableHomeDelivery"
              label="Home Delivery"
              defaultChecked={settings.enableHomeDelivery}
            />
            <Toggle
              name="enablePickup"
              label="Shop Pickup"
              hint="Pickup is always free of delivery charge."
              defaultChecked={settings.enablePickup}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="defaultDeliveryFee">
                Default Delivery Fee (৳)
              </Label>
              <Input
                id="defaultDeliveryFee"
                name="defaultDeliveryFee"
                type="number"
                min={0}
                step="0.01"
                defaultValue={settings.defaultDeliveryFee}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="freeDeliveryThreshold">
                Free Delivery Threshold (৳)
              </Label>
              <Input
                id="freeDeliveryThreshold"
                name="freeDeliveryThreshold"
                type="number"
                min={0}
                step="0.01"
                defaultValue={settings.freeDeliveryThreshold}
              />
              <p className="text-xs text-slate-500">
                0 means no free delivery. Orders at or above this subtotal
                ship free.
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="deliveryAreas">Delivery Areas (JSON)</Label>
            <Textarea
              id="deliveryAreas"
              name="deliveryAreas"
              rows={5}
              className="font-mono text-sm"
              defaultValue={JSON.stringify(settings.deliveryAreas, null, 2)}
              placeholder='[{"area": "Chattogram City", "fee": 60}]'
            />
            <p className="text-xs text-slate-500">
              JSON array of {"{area, fee}"} pairs. An area fee overrides the
              default fee when the delivery area or district matches. Leave
              empty ([]) to use the default fee everywhere.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Payments */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Methods</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Toggle
              name="enableCod"
              label="Cash on Delivery"
              defaultChecked={settings.enableCod}
            />
            <Toggle
              name="enableCashAtShop"
              label="Cash at Shop"
              defaultChecked={settings.enableCashAtShop}
            />
            <Toggle
              name="enableBkash"
              label="bKash"
              defaultChecked={settings.enableBkash}
            />
            <Toggle
              name="enableNagad"
              label="Nagad"
              defaultChecked={settings.enableNagad}
            />
            <Toggle
              name="enableRocket"
              label="Rocket"
              defaultChecked={settings.enableRocket}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bkashNumber">bKash Number</Label>
                <Input
                  id="bkashNumber"
                  name="bkashNumber"
                  defaultValue={settings.bkashNumber}
                  placeholder="01XXXXXXXXX"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bkashInstructions">bKash Instructions</Label>
                <Textarea
                  id="bkashInstructions"
                  name="bkashInstructions"
                  defaultValue={settings.bkashInstructions}
                  placeholder="Send money to this number and submit the TrxID."
                />
              </div>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nagadNumber">Nagad Number</Label>
                <Input
                  id="nagadNumber"
                  name="nagadNumber"
                  defaultValue={settings.nagadNumber}
                  placeholder="01XXXXXXXXX"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nagadInstructions">Nagad Instructions</Label>
                <Textarea
                  id="nagadInstructions"
                  name="nagadInstructions"
                  defaultValue={settings.nagadInstructions}
                  placeholder="Send money to this number and submit the TrxID."
                />
              </div>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="rocketNumber">Rocket Number</Label>
                <Input
                  id="rocketNumber"
                  name="rocketNumber"
                  defaultValue={settings.rocketNumber}
                  placeholder="01XXXXXXXXX"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rocketInstructions">
                  Rocket Instructions
                </Label>
                <Textarea
                  id="rocketInstructions"
                  name="rocketInstructions"
                  defaultValue={settings.rocketInstructions}
                  placeholder="Send money to this number and submit the TrxID."
                />
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Payments are verified manually by the admin from the order page —
            there is no automatic payment gateway connected.
          </p>
        </CardContent>
      </Card>

      {/* Times */}
      <Card>
        <CardHeader>
          <CardTitle>Estimated Times</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="estimatedProcessingTime">
              Estimated Processing Time
            </Label>
            <Input
              id="estimatedProcessingTime"
              name="estimatedProcessingTime"
              defaultValue={settings.estimatedProcessingTime}
              placeholder="e.g. 1-2 days"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="estimatedDeliveryTime">
              Estimated Delivery Time
            </Label>
            <Input
              id="estimatedDeliveryTime"
              name="estimatedDeliveryTime"
              defaultValue={settings.estimatedDeliveryTime}
              placeholder="e.g. 2-3 days"
            />
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            No email or SMS sender is configured yet. Turning these toggles on
            only enables the settings structure — no email or SMS will
            actually be delivered until a sender (email service / SMS
            provider) is configured. In-app notifications to the
            customer&apos;s account still work regardless of these toggles.
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Toggle
              name="emailNotificationsEnabled"
              label="Email Notifications"
              hint="Requires an email sender to be configured."
              defaultChecked={settings.emailNotificationsEnabled}
            />
            <Toggle
              name="smsNotificationsEnabled"
              label="SMS Notifications"
              hint="Requires an SMS provider to be configured."
              defaultChecked={settings.smsNotificationsEnabled}
            />
            <Toggle
              name="otpEnabled"
              label="OTP Verification"
              hint="Requires an SMS provider to be configured."
              defaultChecked={settings.otpEnabled}
            />
          </div>
        </CardContent>
      </Card>

      <div className="sticky bottom-4 flex justify-end">
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? "Saving..." : "Save Order Settings"}
        </Button>
      </div>
    </form>
  );
}
