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
 * The category `icon` column stores a name, not a component — so the name has to be resolved
 * against an explicit map. A `import * as Icons from "lucide-react"` here would work identically
 * in dev and put the whole icon set (several hundred KB) in the client bundle, which is exactly
 * the kind of thing that quietly decides Largest Contentful Paint on a 3G phone in Lagos.
 *
 * Adding a category with a new icon means adding it below; the fallback keeps the page honest
 * (a storefront glyph) rather than blank.
 */
const ICONS: Record<string, LucideIcon> = {
  Smartphone,
  UtensilsCrossed,
  Scissors,
  Sparkles,
  Building2,
  Truck,
  PartyPopper,
  Car,
  Stethoscope,
  GraduationCap,
  Briefcase,
  Wrench,
  Store,
};

export function CategoryIcon({
  name,
  className,
  label,
}: {
  name: string;
  className?: string;
  /** Alternative text for the case where the glyph is the only thing describing the category. */
  label?: string;
}) {
  const Icon = ICONS[name] ?? Store;
  return (
    <Icon
      className={className}
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
    />
  );
}
