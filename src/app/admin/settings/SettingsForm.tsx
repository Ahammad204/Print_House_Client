"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { ImagePlus, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { updateSettings } from "./actions";

export type ServiceItem = {
  title: string;
  description: string;
  icon: string;
};

const SERVICE_ICONS = ["Gift", "Printer", "Copy", "Image", "Sparkles", "BookOpen"];

const EMPTY_SERVICE: ServiceItem = { title: "", description: "", icon: "Gift" };

function parseServices(raw: string | undefined): ServiceItem[] {
  if (!raw) return [EMPTY_SERVICE];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((s) => ({
        title: String(s?.title ?? ""),
        description: String(s?.description ?? ""),
        icon: SERVICE_ICONS.includes(String(s?.icon ?? ""))
          ? String(s.icon)
          : "Gift",
      }));
    }
  } catch {
    // Fall through to a single blank row.
  }
  return [EMPTY_SERVICE];
}

function ImageUpload({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        toast.error(data.error ?? "Upload failed");
        return;
      }
      onChange(data.url);
      toast.success("Image uploaded");
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {value && (
        <div className="relative w-fit">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt={label}
            className="h-24 w-auto max-w-64 rounded-md border object-contain bg-slate-50"
          />
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="absolute -right-2 -top-2 h-6 w-6 rounded-full p-0"
            onClick={() => onChange("")}
            aria-label={`Remove ${label}`}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}
      <div className="flex items-center gap-2">
        <Input
          type="file"
          accept="image/*"
          disabled={uploading}
          onChange={(e) => {
            void handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
          className="max-w-xs"
        />
        {uploading && (
          <span className="text-sm text-slate-500">Uploading...</span>
        )}
      </div>
      {value && (
        <p className="break-all text-xs text-slate-500">{value}</p>
      )}
      {!value && (
        <p className="flex items-center gap-1 text-xs text-slate-400">
          <ImagePlus className="h-3 w-3" />
          No image set yet.
        </p>
      )}
    </div>
  );
}

export default function SettingsForm({
  settings,
  products,
  categories,
}: {
  settings: Record<string, string>;
  products: { id: string; name: string; featured: boolean }[];
  categories: { id: string; name: string; status: string }[];
}) {
  const get = (key: string) => settings[key] ?? "";

  const [services, setServices] = useState<ServiceItem[]>(() =>
    parseServices(settings.services)
  );
  const [featuredProductIds, setFeaturedProductIds] = useState<string[]>(
    () => get("featuredProductIds").split(",").map((s) => s.trim()).filter(Boolean)
  );
  const [featuredCategoryIds, setFeaturedCategoryIds] = useState<string[]>(
    () => get("featuredCategoryIds").split(",").map((s) => s.trim()).filter(Boolean)
  );
  const [heroImage, setHeroImage] = useState(get("heroImage"));
  const [logo, setLogo] = useState(get("logo"));
  const [favicon, setFavicon] = useState(get("favicon"));
  const [ogImage, setOgImage] = useState(get("ogImage"));
  const [primaryColor, setPrimaryColor] = useState(get("primaryColor") || "#2563EB");
  const [accentColor, setAccentColor] = useState(get("accentColor") || "#F59E0B");
  const [isPending, startTransition] = useTransition();

  function toggleId(list: string[], id: string, setList: (v: string[]) => void) {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("services", JSON.stringify(services.filter((s) => s.title.trim())));
    formData.set("featuredProductIds", featuredProductIds.join(","));
    formData.set("featuredCategoryIds", featuredCategoryIds.join(","));
    formData.set("heroImage", heroImage);
    formData.set("logo", logo);
    formData.set("favicon", favicon);
    formData.set("ogImage", ogImage);
    formData.set("primaryColor", primaryColor);
    formData.set("accentColor", accentColor);

    startTransition(async () => {
      const result = await updateSettings(formData);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Settings saved");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* General */}
      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="shopName">Shop Name</Label>
            <Input id="shopName" name="shopName" defaultValue={get("shopName")} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tagline">Tagline / Description</Label>
            <Input id="tagline" name="tagline" defaultValue={get("tagline")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" name="phone" defaultValue={get("phone")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="whatsapp">WhatsApp Number</Label>
            <Input id="whatsapp" name="whatsapp" defaultValue={get("whatsapp")} />
            <p className="text-xs text-slate-500">
              Digits only, e.g. 8801812345678
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" defaultValue={get("email")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="openingHours">Opening Hours</Label>
            <Input id="openingHours" name="openingHours" defaultValue={get("openingHours")} placeholder="e.g. Sat – Thu: 9:00 AM – 9:00 PM" />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="address">Address</Label>
            <Textarea id="address" name="address" defaultValue={get("address")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mapsUrl">Google Maps URL</Label>
            <Input id="mapsUrl" name="mapsUrl" type="url" defaultValue={get("mapsUrl")} placeholder="https://maps.google.com/..." />
          </div>
          <div className="space-y-2">
            <Label htmlFor="facebook">Facebook URL</Label>
            <Input id="facebook" name="facebook" type="url" defaultValue={get("facebook")} placeholder="https://facebook.com/..." />
          </div>
          <div className="space-y-2">
            <Label htmlFor="instagram">Instagram URL</Label>
            <Input id="instagram" name="instagram" type="url" defaultValue={get("instagram")} placeholder="https://instagram.com/..." />
          </div>
        </CardContent>
      </Card>

      {/* Homepage */}
      <Card>
        <CardHeader>
          <CardTitle>Homepage</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="heroTitle">Hero Title</Label>
              <Input id="heroTitle" name="heroTitle" defaultValue={get("heroTitle")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="aboutTitle">About Title</Label>
              <Input id="aboutTitle" name="aboutTitle" defaultValue={get("aboutTitle")} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="heroDescription">Hero Description</Label>
              <Textarea id="heroDescription" name="heroDescription" defaultValue={get("heroDescription")} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="aboutText">About Text</Label>
              <Textarea id="aboutText" name="aboutText" defaultValue={get("aboutText")} />
            </div>
          </div>

          <ImageUpload label="Hero Image" value={heroImage} onChange={setHeroImage} />

          {/* Services editor */}
          <div className="space-y-3">
            <Label>Services</Label>
            {services.map((service, i) => (
              <div key={i} className="grid grid-cols-1 gap-2 rounded-md border p-3 sm:grid-cols-[1fr_2fr_160px_auto]">
                <Input
                  placeholder="Title"
                  value={service.title}
                  onChange={(e) =>
                    setServices(services.map((s, j) => (j === i ? { ...s, title: e.target.value } : s)))
                  }
                />
                <Input
                  placeholder="Description"
                  value={service.description}
                  onChange={(e) =>
                    setServices(services.map((s, j) => (j === i ? { ...s, description: e.target.value } : s)))
                  }
                />
                <Select
                  value={service.icon}
                  onValueChange={(v) =>
                    setServices(services.map((s, j) => (j === i ? { ...s, icon: v } : s)))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Icon" />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICE_ICONS.map((icon) => (
                      <SelectItem key={icon} value={icon}>
                        {icon}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => setServices(services.filter((_, j) => j !== i))}
                  disabled={services.length <= 1}
                  aria-label="Remove service"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setServices([...services, { ...EMPTY_SERVICE }])}
            >
              <Plus className="mr-1 h-4 w-4" />
              Add Service
            </Button>
          </div>

          {/* Featured products */}
          <div className="space-y-2">
            <Label>Featured Products</Label>
            <p className="text-xs text-slate-500">
              Leave empty to use products marked Featured.
            </p>
            <div className="max-h-64 space-y-2 overflow-y-auto rounded-md border p-3">
              {products.length === 0 && (
                <p className="text-sm text-slate-500">No products yet.</p>
              )}
              {products.map((p) => (
                <label key={p.id} className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox
                    checked={featuredProductIds.includes(p.id)}
                    onCheckedChange={() =>
                      toggleId(featuredProductIds, p.id, setFeaturedProductIds)
                    }
                  />
                  <span>
                    {p.name}
                    {p.featured && (
                      <span className="ml-2 text-xs text-slate-400">(Featured)</span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Featured categories */}
          <div className="space-y-2">
            <Label>Featured Categories</Label>
            <p className="text-xs text-slate-500">
              Leave empty to use active categories by display order.
            </p>
            <div className="max-h-64 space-y-2 overflow-y-auto rounded-md border p-3">
              {categories.length === 0 && (
                <p className="text-sm text-slate-500">No categories yet.</p>
              )}
              {categories.map((c) => (
                <label key={c.id} className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox
                    checked={featuredCategoryIds.includes(c.id)}
                    onCheckedChange={() =>
                      toggleId(featuredCategoryIds, c.id, setFeaturedCategoryIds)
                    }
                  />
                  <span>
                    {c.name}
                    {c.status !== "active" && (
                      <span className="ml-2 text-xs text-slate-400">(Inactive)</span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="primaryColor">Primary Colour</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="primaryColor"
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-10 w-16 cursor-pointer p-1"
                />
                <Input
                  type="text"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="max-w-32"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="accentColor">Accent Colour</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="accentColor"
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="h-10 w-16 cursor-pointer p-1"
                />
                <Input
                  type="text"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="max-w-32"
                />
              </div>
            </div>
          </div>
          <ImageUpload label="Logo" value={logo} onChange={setLogo} />
          <ImageUpload label="Favicon" value={favicon} onChange={setFavicon} />
        </CardContent>
      </Card>

      {/* SEO */}
      <Card>
        <CardHeader>
          <CardTitle>SEO</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="seoTitle">SEO Title</Label>
            <Input id="seoTitle" name="seoTitle" defaultValue={get("seoTitle")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="seoDescription">SEO Description</Label>
            <Textarea id="seoDescription" name="seoDescription" defaultValue={get("seoDescription")} />
          </div>
          <ImageUpload label="Open Graph Image" value={ogImage} onChange={setOgImage} />
        </CardContent>
      </Card>

      <div className="sticky bottom-4 flex justify-end">
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </form>
  );
}
