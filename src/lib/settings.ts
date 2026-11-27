import { db } from "@/lib/db";

export const DEFAULT_SETTINGS: Record<string, string> = {
  shopName: "Kazi Gift and Print House",
  tagline: "Your Creativity, Our Printing & Gift Solutions.",
  phone: "+880 1812-345678",
  whatsapp: "8801812345678",
  email: "info@kazigiftprint.com",
  address: "Chattogram, Bangladesh",
  mapsUrl: "https://maps.google.com/?q=Chattogram",
  facebook: "https://facebook.com/kazigiftprint",
  instagram: "https://instagram.com/kazigiftprint",
  openingHours: "Sat–Thu: 9:00 AM – 9:00 PM, Fri: Closed",
  heroTitle: "Your Creativity, Our Printing & Gift Solutions.",
  heroDescription:
    "Customized gifts, quality printing, stationery and photocopy — everything your creativity needs, under one roof in Chattogram.",
  heroImage: "/images/hero.svg",
  aboutTitle: "About Kazi Gift and Print House",
  aboutText:
    "Kazi Gift and Print House is a local gift, printing and stationery shop in Chattogram. From customized mugs and photo frames to digital printing, photocopy and everyday stationery, we help you turn ideas into something you can hold.",
  services: JSON.stringify([
    {
      title: "Gift Items",
      description: "Thoughtful gifts for every occasion.",
      icon: "Gift",
    },
    {
      title: "Digital Printing",
      description: "High-quality colour and black & white printing.",
      icon: "Printer",
    },
    {
      title: "Photocopy",
      description: "Fast, clear photocopy for documents and notes.",
      icon: "Copy",
    },
    {
      title: "Photo Printing",
      description: "Vivid photo prints in many sizes.",
      icon: "Image",
    },
    {
      title: "Customized Gifts",
      description: "Mugs, frames and more, personalized for you.",
      icon: "Sparkles",
    },
    {
      title: "Stationery",
      description: "Notebooks, pens and everyday essentials.",
      icon: "BookOpen",
    },
  ]),
  featuredProductIds: "",
  featuredCategoryIds: "",
  primaryColor: "#2563EB",
  accentColor: "#F59E0B",
  seoTitle: "Kazi Gift and Print House — Gifts, Printing & Stationery",
  seoDescription:
    "Customized gifts, printing, photocopy and stationery in Chattogram. Quality products at fair prices.",
  ogImage: "/images/hero.svg",
  logo: "",
  favicon: "",
};

/** Read all WebsiteSetting rows, merged over DEFAULT_SETTINGS. */
export async function getSettings(): Promise<Record<string, string>> {
  try {
    const rows = await db.websiteSetting.findMany();
    const settings: Record<string, string> = { ...DEFAULT_SETTINGS };
    for (const row of rows) {
      settings[row.key] = row.value;
    }
    return settings;
  } catch {
    // Database unavailable (e.g. during `next build` prerendering or before
    // first deploy): fall back to the built-in defaults so the public site
    // still renders instead of crashing.
    return { ...DEFAULT_SETTINGS };
  }
}

/** Read a single setting, falling back to its default (or "" if unknown). */
export async function getSetting(key: string): Promise<string> {
  const settings = await getSettings();
  return settings[key] ?? DEFAULT_SETTINGS[key] ?? "";
}
