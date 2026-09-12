export type Business = {
  id: string;
  name: string;
  tagline: string;
  about: string;
  category: string;
  categorySlug: string;
  city: string;
  state: string;
  address: string;
  rating: number;
  reviews: number;
  verified: "unverified" | "email" | "phone" | "documents" | "premium";
  openNow: boolean;
  hours: { day: string; open: string }[];
  whatsapp: string;
  phone: string;
  website: string;
  socials: { label: string; handle: string }[];
  services: { name: string; price: string; note: string }[];
  products: { name: string; price: string; tag: string }[];
  amenities: string[];
  serviceAreas: string[];
  gallery: { label: string; kind: string }[];
  team: { name: string; role: string }[];
  plan: "Free" | "Growth" | "Pro";
  contactsGained: number;
  savedBy: number;
  cover: string;
  isDemo: true;
};

const hours = [
  { day: "Monday", open: "8:00 AM – 6:00 PM" },
  { day: "Tuesday", open: "8:00 AM – 6:00 PM" },
  { day: "Wednesday", open: "8:00 AM – 6:00 PM" },
  { day: "Thursday", open: "8:00 AM – 6:00 PM" },
  { day: "Friday", open: "8:00 AM – 7:00 PM" },
  { day: "Saturday", open: "9:00 AM – 4:00 PM" },
  { day: "Sunday", open: "Closed" },
];

export const categories = [
  { slug: "phone-gadgets", name: "Phone & Gadget Repair", icon: "Smartphone" },
  { slug: "food-restaurants", name: "Food & Restaurants", icon: "UtensilsCrossed" },
  { slug: "fashion-tailoring", name: "Fashion & Tailoring", icon: "Scissors" },
  { slug: "beauty-spa", name: "Beauty, Hair & Spa", icon: "Sparkles" },
  { slug: "real-estate", name: "Real Estate & Agents", icon: "Building2" },
  { slug: "logistics", name: "Logistics & Dispatch", icon: "Truck" },
  { slug: "events", name: "Events & Rentals", icon: "PartyPopper" },
  { slug: "auto", name: "Auto & Mechanics", icon: "Car" },
  { slug: "health", name: "Health & Pharmacy", icon: "Stethoscope" },
  { slug: "education", name: "Schools & Tutors", icon: "GraduationCap" },
  { slug: "professionals", name: "Professionals & Legal", icon: "Briefcase" },
  { slug: "home-services", name: "Home Services", icon: "Wrench" },
];

export const locations = [
  { slug: "lagos", name: "Lagos", areas: ["Ikeja", "Lekki", "Yaba", "Surulere", "Ajah"] },
  { slug: "abuja", name: "Abuja (FCT)", areas: ["Wuse", "Garki", "Gwarinpa", "Lugbe"] },
  { slug: "port-harcourt", name: "Port Harcourt", areas: ["GRA", "D-Line", "Rumuokoro"] },
  { slug: "ibadan", name: "Ibadan", areas: ["Bodija", "Ring Road", "Challenge"] },
  { slug: "kano", name: "Kano", areas: ["Nassarawa", "Sabon Gari"] },
  { slug: "enugu", name: "Enugu", areas: ["Independence Layout", "New Haven"] },
];

function make(
  id: string,
  name: string,
  tagline: string,
  categorySlug: string,
  city: string,
  state: string,
  extra: Partial<Business> = {},
): Business {
  const cat = categories.find((c) => c.slug === categorySlug)!;
  return {
    id,
    name,
    tagline,
    about: `${name} is a ${cat.name.toLowerCase()} business serving ${city} and nearby areas. We take enquiries on WhatsApp, respond within minutes during working hours, and handle both walk-in and delivery requests across the city.`,
    category: cat.name,
    categorySlug,
    city,
    state,
    address: `12 Adekunle Close, ${city}, ${state}`,
    rating: 4.6,
    reviews: 128,
    verified: "documents",
    openNow: true,
    hours,
    whatsapp: "+234 803 000 0000",
    phone: "+234 803 000 0000",
    website: `www.${id}.ng`,
    socials: [
      { label: "Instagram", handle: `@${id}` },
      { label: "TikTok", handle: `@${id}ng` },
    ],
    services: [
      { name: "Standard service", price: "₦15,000", note: "Same-day where possible" },
      { name: "Premium service", price: "₦45,000", note: "Priority handling" },
      { name: "Consultation", price: "Free", note: "On WhatsApp" },
    ],
    products: [
      { name: "Starter package", price: "₦25,000", tag: "Popular" },
      { name: "Bundle offer", price: "₦60,000", tag: "Offer" },
      { name: "Enterprise", price: "Request quote", tag: "B2B" },
    ],
    amenities: ["Parking", "Card payment", "Transfer accepted", "Delivery", "Wheelchair access"],
    serviceAreas: ["Island", "Mainland", "Nationwide delivery"],
    gallery: [
      { label: "Logo", kind: "Brand" },
      { label: "Cover photo", kind: "Brand" },
      { label: "Shop front", kind: "Premises" },
      { label: "Interior", kind: "Premises" },
      { label: "Team at work", kind: "Team" },
      { label: "Product shot 1", kind: "Products" },
      { label: "Product shot 2", kind: "Products" },
      { label: "Before / after", kind: "Work" },
      { label: "CAC certificate", kind: "Verification" },
    ],
    team: [
      { name: "Chidi Okonkwo", role: "Owner" },
      { name: "Amina Bello", role: "Sales agent" },
    ],
    plan: "Growth",
    contactsGained: 1840,
    savedBy: 312,
    cover: "bg-ink-mesh",
    isDemo: true,
    ...extra,
  };
}

export const businesses: Business[] = [
  make(
    "swiftfix-gadgets",
    "SwiftFix Gadgets",
    "Phone & laptop repair in 45 minutes",
    "phone-gadgets",
    "Ikeja",
    "Lagos",
    {
      rating: 4.8,
      reviews: 412,
      verified: "premium",
      plan: "Pro",
      contactsGained: 5210,
    },
  ),
  make(
    "mama-ope-kitchen",
    "Mama Ope Kitchen",
    "Home-style jollof, swallow & small chops",
    "food-restaurants",
    "Surulere",
    "Lagos",
    {
      rating: 4.7,
      reviews: 903,
    },
  ),
  make(
    "adire-atelier",
    "Adire Atelier",
    "Bespoke agbada, kaftan & aso-oke",
    "fashion-tailoring",
    "Yaba",
    "Lagos",
    {
      rating: 4.9,
      reviews: 267,
      verified: "premium",
    },
  ),
  make(
    "glow-by-tola",
    "Glow by Tola",
    "Hair, nails, lashes & home service spa",
    "beauty-spa",
    "Lekki",
    "Lagos",
    {
      rating: 4.6,
      reviews: 512,
    },
  ),
  make(
    "keyhomes-realty",
    "KeyHomes Realty",
    "Verified shortlets, rentals & land in FCT",
    "real-estate",
    "Gwarinpa",
    "Abuja",
    {
      rating: 4.3,
      reviews: 89,
      plan: "Pro",
    },
  ),
  make(
    "rapid-dispatch-ng",
    "Rapid Dispatch NG",
    "Same-day bike & van dispatch",
    "logistics",
    "Wuse",
    "Abuja",
    {
      rating: 4.5,
      reviews: 341,
    },
  ),
  make(
    "crown-events",
    "Crown Events & Rentals",
    "Canopies, chairs, décor & MC services",
    "events",
    "GRA",
    "Port Harcourt",
    {
      rating: 4.4,
      reviews: 156,
    },
  ),
  make(
    "autoplug-mechanics",
    "AutoPlug Mechanics",
    "Mobile mechanic & diagnostics",
    "auto",
    "Ring Road",
    "Ibadan",
    {
      rating: 4.2,
      reviews: 204,
      openNow: false,
    },
  ),
  make(
    "wellcare-pharmacy",
    "WellCare Pharmacy",
    "Registered pharmacy with delivery",
    "health",
    "New Haven",
    "Enugu",
    {
      rating: 4.7,
      reviews: 121,
    },
  ),
  make(
    "brightpath-tutors",
    "BrightPath Tutors",
    "WAEC, JAMB & IELTS coaching",
    "education",
    "Bodija",
    "Ibadan",
    {
      rating: 4.8,
      reviews: 76,
    },
  ),
  make(
    "okoro-associates",
    "Okoro & Associates",
    "Property law, contracts & CAC filings",
    "professionals",
    "D-Line",
    "Port Harcourt",
    {
      rating: 4.5,
      reviews: 44,
    },
  ),
  make(
    "fixit-home-services",
    "FixIt Home Services",
    "Plumbing, POP, electrical & cleaning",
    "home-services",
    "Ajah",
    "Lagos",
    {
      rating: 4.1,
      reviews: 289,
    },
  ),
];

export const getBusiness = (id: string) => businesses.find((business) => business.id === id);
