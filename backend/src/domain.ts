import type { BusinessRow } from "./auth";
import { parseJson } from "./util";
import type {
  Business,
  GalleryItem,
  HourRow,
  Product,
  Service,
  Social,
  TeamMemberEntry,
} from "./shared";

export function mapBusiness(row: BusinessRow): Business {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    tagline: row.tagline,
    about: row.about,
    categorySlug: row.category_slug,
    city: row.city,
    state: row.state,
    address: row.address,
    rating: row.rating,
    reviewsCount: row.reviews_count,
    verified: row.verified as Business["verified"],
    openNow: row.open_now === 1,
    whatsapp: row.whatsapp,
    phone: row.phone,
    website: row.website,
    socials: parseJson<Social[]>(row.socials, []),
    services: parseJson<Service[]>(row.services, []),
    products: parseJson<Product[]>(row.products, []),
    amenities: parseJson<string[]>(row.amenities, []),
    serviceAreas: parseJson<string[]>(row.service_areas, []),
    gallery: parseJson<GalleryItem[]>(row.gallery, []),
    team: parseJson<TeamMemberEntry[]>(row.team, []),
    hours: parseJson<HourRow[]>(row.hours, []),
    plan: row.plan as Business["plan"],
    contactsGained: row.contacts_gained,
    savedBy: row.saved_by,
    featured: row.featured === 1,
    responseMinutes: row.response_minutes,
    ts: Math.max(0, Math.round((Date.now() - row.created_at) / 60_000)),
    cover: "bg-ink-mesh",
    status: row.status,
  };
}
