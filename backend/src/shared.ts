/** Shared domain types — kept in sync with the frontend's `src/lib/types.ts`. */

export type VerificationLevel = "unverified" | "email" | "phone" | "documents" | "premium";
export type Plan = "Free" | "Growth" | "Pro";

export type Social = { label: string; handle: string };
export type Service = { name: string; price: string; note: string };
export type Product = { name: string; price: string; tag: string };
export type GalleryItem = { label: string; kind: string };
export type TeamMemberEntry = { name: string; role: string };
export type HourRow = { day: string; open: string };

export type Business = {
  id: string;
  ownerId: string | null;
  name: string;
  tagline: string;
  about: string;
  categorySlug: string;
  categoryName?: string;
  city: string;
  state: string;
  address: string;
  rating: number;
  reviewsCount: number;
  verified: VerificationLevel;
  openNow: boolean;
  whatsapp: string;
  phone: string;
  website: string;
  socials: Social[];
  services: Service[];
  products: Product[];
  amenities: string[];
  serviceAreas: string[];
  gallery: GalleryItem[];
  team: TeamMemberEntry[];
  plan: Plan;
  contactsGained: number;
  savedBy: number;
  featured: boolean;
  responseMinutes: number;
  ts: number;
  cover: string;
  status: string;
  hours?: HourRow[];
};
