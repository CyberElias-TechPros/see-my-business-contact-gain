import {
  Briefcase,
  Building2,
  Car,
  GraduationCap,
  PartyPopper,
  Scissors,
  Smartphone,
  Sparkles,
  Stethoscope,
  Store,
  Truck,
  UtensilsCrossed,
  Wrench,
  type LucideIcon,
} from "lucide-react";

/**
 * Category slug → icon. The taxonomy lives in D1, so the mapping is keyed on the
 * slug rather than an icon name stored in the database. Unknown slugs fall back to
 * a neutral storefront mark instead of rendering nothing.
 */
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  "phone-gadgets": Smartphone,
  "food-restaurants": UtensilsCrossed,
  "fashion-tailoring": Scissors,
  "beauty-spa": Sparkles,
  "real-estate": Building2,
  logistics: Truck,
  events: PartyPopper,
  auto: Car,
  health: Stethoscope,
  education: GraduationCap,
  professionals: Briefcase,
  "home-services": Wrench,
};

export function categoryIcon(slug: string): LucideIcon {
  return CATEGORY_ICONS[slug] ?? Store;
}
