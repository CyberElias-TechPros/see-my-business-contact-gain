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
  /** Tailwind background class: a deterministic cover for listings without an approved photo. */
  cover: string;
  /** Same-origin URL of the approved cover image, when the listing has one. */
  coverUrl?: string | undefined;
  /** wa.me link with the business's own number, so the card's CTA is a real conversation. */
  whatsappUrl?: string | undefined;
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
  { slug: "phone-gadgets", name: "Phone & Gadget Repair", icon: "Smartphone", count: 4820 },
  { slug: "food-restaurants", name: "Food & Restaurants", icon: "UtensilsCrossed", count: 9310 },
  { slug: "fashion-tailoring", name: "Fashion & Tailoring", icon: "Scissors", count: 7640 },
  { slug: "beauty-spa", name: "Beauty, Hair & Spa", icon: "Sparkles", count: 6120 },
  { slug: "real-estate", name: "Real Estate & Agents", icon: "Building2", count: 3410 },
  { slug: "logistics", name: "Logistics & Dispatch", icon: "Truck", count: 2870 },
  { slug: "events", name: "Events & Rentals", icon: "PartyPopper", count: 2210 },
  { slug: "auto", name: "Auto & Mechanics", icon: "Car", count: 3050 },
  { slug: "health", name: "Health & Pharmacy", icon: "Stethoscope", count: 1890 },
  { slug: "education", name: "Schools & Tutors", icon: "GraduationCap", count: 2440 },
  { slug: "professionals", name: "Professionals & Legal", icon: "Briefcase", count: 1620 },
  { slug: "home-services", name: "Home Services", icon: "Wrench", count: 4110 },
];

export const locations = [
  {
    slug: "lagos",
    name: "Lagos",
    areas: ["Ikeja", "Lekki", "Yaba", "Surulere", "Ajah"],
    count: 24800,
  },
  {
    slug: "abuja",
    name: "Abuja (FCT)",
    areas: ["Wuse", "Garki", "Gwarinpa", "Lugbe"],
    count: 11200,
  },
  {
    slug: "port-harcourt",
    name: "Port Harcourt",
    areas: ["GRA", "D-Line", "Rumuokoro"],
    count: 6400,
  },
  { slug: "ibadan", name: "Ibadan", areas: ["Bodija", "Ring Road", "Challenge"], count: 5100 },
  { slug: "kano", name: "Kano", areas: ["Nassarawa", "Sabon Gari"], count: 3900 },
  { slug: "enugu", name: "Enugu", areas: ["Independence Layout", "New Haven"], count: 3200 },
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

export const getBusiness = (id: string) => businesses.find((b) => b.id === id) ?? businesses[0]!;

export const contactGainRooms = [
  {
    id: "lagos-vendors-hub",
    name: "Lagos Vendors Hub",
    purpose: "Business promotion",
    members: 4820,
    slotsLeft: 180,
    rule: "Save all, post one status daily",
    verifiedOnly: true,
    state: "Lagos",
  },
  {
    id: "naija-fashion-plug",
    name: "Naija Fashion Plug",
    purpose: "Fashion & tailoring vendors",
    members: 2610,
    slotsLeft: 90,
    rule: "Save back within 24 hours",
    verifiedOnly: true,
    state: "Nationwide",
  },
  {
    id: "abuja-hustlers",
    name: "Abuja Hustlers Circle",
    purpose: "General networking",
    members: 3150,
    slotsLeft: 45,
    rule: "No adult content, no scam links",
    verifiedOnly: false,
    state: "Abuja",
  },
  {
    id: "delivery-riders-ng",
    name: "Delivery Riders NG",
    purpose: "Logistics partners",
    members: 1290,
    slotsLeft: 210,
    rule: "Riders and dispatch owners only",
    verifiedOnly: true,
    state: "Nationwide",
  },
];

export const leads = [
  {
    id: "LD-1041",
    name: "Blessing Eze",
    source: "Directory profile",
    channel: "WhatsApp",
    stage: "New",
    value: "₦45,000",
    agent: "Amina B.",
    updated: "3 min ago",
    score: 82,
  },
  {
    id: "LD-1040",
    name: "Musa Ibrahim",
    source: "QR — Ikeja shop",
    channel: "WhatsApp",
    stage: "Qualified",
    value: "₦120,000",
    agent: "Chidi O.",
    updated: "18 min ago",
    score: 91,
  },
  {
    id: "LD-1039",
    name: "Ngozi Umeh",
    source: "Campaign — August offer",
    channel: "Form",
    stage: "Quotation",
    value: "₦310,000",
    agent: "Amina B.",
    updated: "1 hr ago",
    score: 74,
  },
  {
    id: "LD-1038",
    name: "Tunde Ade",
    source: "Referral link",
    channel: "WhatsApp",
    stage: "Follow up",
    value: "₦28,000",
    agent: "Unassigned",
    updated: "2 hr ago",
    score: 51,
  },
  {
    id: "LD-1037",
    name: "Fatima Sani",
    source: "Website widget",
    channel: "WhatsApp",
    stage: "Won",
    value: "₦85,000",
    agent: "Chidi O.",
    updated: "Yesterday",
    score: 96,
  },
  {
    id: "LD-1036",
    name: "Emeka Nwosu",
    source: "Contact-gain room",
    channel: "WhatsApp",
    stage: "Lost",
    value: "₦15,000",
    agent: "Amina B.",
    updated: "2 days ago",
    score: 33,
  },
];

export const pipelineStages = ["New", "Qualified", "Quotation", "Follow up", "Won", "Lost"];

export const conversations = [
  {
    id: "c1",
    name: "Blessing Eze",
    last: "Do you repair iPhone 13 screen today?",
    time: "3m",
    unread: 2,
    tag: "New WhatsApp lead",
    assigned: "Amina B.",
  },
  {
    id: "c2",
    name: "Musa Ibrahim",
    last: "Send me your account details",
    time: "18m",
    unread: 0,
    tag: "Hot",
    assigned: "Chidi O.",
  },
  {
    id: "c3",
    name: "Ngozi Umeh",
    last: "I've shared the quotation, please review.",
    time: "1h",
    unread: 0,
    tag: "Quotation",
    assigned: "Amina B.",
  },
  {
    id: "c4",
    name: "Tunde Ade",
    last: "Okay I will come tomorrow",
    time: "2h",
    unread: 1,
    tag: "Callback",
    assigned: "Unassigned",
  },
  {
    id: "c5",
    name: "Fatima Sani",
    last: "Thank you 🙏",
    time: "1d",
    unread: 0,
    tag: "Customer",
    assigned: "Chidi O.",
  },
];

export const tasks = [
  {
    id: "T-91",
    title: "Call Blessing about screen repair",
    due: "Today 4:00 PM",
    owner: "Amina B.",
    priority: "High",
    done: false,
  },
  {
    id: "T-90",
    title: "Send quotation to Ngozi",
    due: "Today 6:00 PM",
    owner: "Chidi O.",
    priority: "High",
    done: false,
  },
  {
    id: "T-89",
    title: "Follow up stale lead — Tunde",
    due: "Tomorrow",
    owner: "Amina B.",
    priority: "Medium",
    done: false,
  },
  {
    id: "T-88",
    title: "Upload new product photos",
    due: "Fri",
    owner: "Chidi O.",
    priority: "Low",
    done: true,
  },
];

export const campaigns = [
  {
    id: "CMP-12",
    name: "August repair offer",
    channel: "WhatsApp link",
    scans: 1820,
    leads: 412,
    cost: "₦45,000",
    cpl: "₦109",
    status: "Live",
  },
  {
    id: "CMP-11",
    name: "Ikeja shop QR",
    channel: "QR code",
    scans: 940,
    leads: 233,
    cost: "₦8,000",
    cpl: "₦34",
    status: "Live",
  },
  {
    id: "CMP-10",
    name: "Contact-gain room push",
    channel: "Room",
    scans: 3100,
    leads: 690,
    cost: "₦0",
    cpl: "₦0",
    status: "Live",
  },
  {
    id: "CMP-09",
    name: "Ramadan bundle",
    channel: "Campaign link",
    scans: 2400,
    leads: 301,
    cost: "₦60,000",
    cpl: "₦199",
    status: "Ended",
  },
];

export const contactLinks = [
  {
    id: "LK-31",
    label: "Main profile button",
    url: "gain.ng/w/swiftfix",
    scans: 5210,
    source: "Directory",
  },
  { id: "LK-30", label: "Ikeja shop QR", url: "gain.ng/q/ikeja", scans: 940, source: "QR" },
  {
    id: "LK-29",
    label: "Instagram bio",
    url: "gain.ng/w/swiftfix-ig",
    scans: 2110,
    source: "Social",
  },
  { id: "LK-28", label: "Flyer — August", url: "gain.ng/q/aug-flyer", scans: 618, source: "Print" },
];

export const automations = [
  {
    id: "AU-7",
    trigger: "New WhatsApp lead",
    action: "Create contact + tag “New WhatsApp lead”",
    runs: 5210,
    status: "Active",
  },
  {
    id: "AU-6",
    trigger: "No response after 24h",
    action: "Create follow-up task for owner",
    runs: 812,
    status: "Active",
  },
  {
    id: "AU-5",
    trigger: "Quote requested",
    action: "Create opportunity in pipeline",
    runs: 402,
    status: "Active",
  },
  {
    id: "AU-4",
    trigger: "New public review",
    action: "Notify business owner",
    runs: 261,
    status: "Active",
  },
  {
    id: "AU-3",
    trigger: "Profile incomplete 7 days",
    action: "Send completion reminder",
    runs: 143,
    status: "Paused",
  },
  {
    id: "AU-2",
    trigger: "Listing reported",
    action: "Send to moderation queue",
    runs: 58,
    status: "Active",
  },
];

export const teamMembers = [
  {
    name: "Chidi Okonkwo",
    email: "chidi@swiftfix.ng",
    role: "Owner",
    status: "Active",
    lastSeen: "Now",
  },
  {
    name: "Amina Bello",
    email: "amina@swiftfix.ng",
    role: "Sales agent",
    status: "Active",
    lastSeen: "12m ago",
  },
  {
    name: "Seyi Adeoye",
    email: "seyi@swiftfix.ng",
    role: "Marketing",
    status: "Active",
    lastSeen: "1h ago",
  },
  {
    name: "Grace Nnaji",
    email: "grace@swiftfix.ng",
    role: "Staff",
    status: "Invited",
    lastSeen: "—",
  },
];

export const auditLog = [
  { id: "A-501", who: "Amina Bello", what: "Moved LD-1040 to Qualified", when: "10:42 AM" },
  { id: "A-500", who: "System", what: "Auto-assigned LD-1041 to Amina Bello", when: "10:39 AM" },
  { id: "A-499", who: "Chidi Okonkwo", what: "Updated business hours", when: "Yesterday 6:12 PM" },
  { id: "A-498", who: "Seyi Adeoye", what: "Created campaign CMP-12", when: "Yesterday 2:03 PM" },
];

export const adminUsers = [
  {
    id: "U-8812",
    name: "Chidi Okonkwo",
    email: "chidi@swiftfix.ng",
    role: "Business owner",
    state: "Lagos",
    status: "Active",
  },
  {
    id: "U-8811",
    name: "Blessing Eze",
    email: "blessing@gmail.com",
    role: "Consumer",
    state: "Lagos",
    status: "Active",
  },
  {
    id: "U-8810",
    name: "Musa Ibrahim",
    email: "musa@yahoo.com",
    role: "Consumer",
    state: "Kano",
    status: "Suspended",
  },
  {
    id: "U-8809",
    name: "Ada Nwosu",
    email: "ada@keyhomes.ng",
    role: "Business manager",
    state: "Abuja",
    status: "Active",
  },
  {
    id: "U-8808",
    name: "Seyi Adeoye",
    email: "seyi@swiftfix.ng",
    role: "Marketing",
    state: "Lagos",
    status: "Active",
  },
];

export const claims = [
  {
    id: "CL-77",
    business: "Mama Ope Kitchen",
    claimant: "Opeyemi A.",
    evidence: "CAC + utility bill",
    submitted: "2h ago",
    status: "Pending",
  },
  {
    id: "CL-76",
    business: "AutoPlug Mechanics",
    claimant: "Kunle T.",
    evidence: "Shop photo + ID",
    submitted: "1d ago",
    status: "In review",
  },
  {
    id: "CL-75",
    business: "Crown Events",
    claimant: "Chioma E.",
    evidence: "Bank statement",
    submitted: "3d ago",
    status: "Approved",
  },
];

export const moderationQueue = [
  {
    id: "M-231",
    type: "Image",
    item: "Gallery photo — Glow by Tola",
    reason: "AI flag: possible nudity",
    risk: "High",
    age: "5m",
  },
  {
    id: "M-230",
    type: "Listing",
    item: "Quick Loans Naija",
    reason: "Scam keywords",
    risk: "High",
    age: "22m",
  },
  {
    id: "M-229",
    type: "Review",
    item: "Review on SwiftFix Gadgets",
    reason: "Suspected fake review",
    risk: "Medium",
    age: "1h",
  },
  {
    id: "M-228",
    type: "Profile",
    item: "Contact-gain profile #4412",
    reason: "Impersonation report",
    risk: "Medium",
    age: "3h",
  },
];

export const reviews = [
  {
    author: "Blessing E.",
    rating: 5,
    when: "2 days ago",
    body: "They fixed my screen in 40 minutes and the price was exactly what they said on WhatsApp.",
  },
  {
    author: "Musa I.",
    rating: 4,
    when: "1 week ago",
    body: "Good service, but the shop was busy so I waited a while. Still worth it.",
  },
  {
    author: "Ngozi U.",
    rating: 5,
    when: "3 weeks ago",
    body: "Very responsive on WhatsApp. Sent photos of the fault and got a quote immediately.",
  },
];

export const tickets = [
  {
    id: "S-4021",
    subject: "Verification documents rejected",
    user: "Kunle T.",
    priority: "High",
    status: "Open",
    age: "1h",
  },
  {
    id: "S-4020",
    subject: "Cannot connect WhatsApp number",
    user: "Ada Nwosu",
    priority: "Medium",
    status: "Waiting",
    age: "5h",
  },
  {
    id: "S-4019",
    subject: "Refund for Growth plan",
    user: "Chioma E.",
    priority: "Medium",
    status: "Open",
    age: "1d",
  },
];

export const invoices = [
  {
    id: "INV-2211",
    plan: "Growth — monthly",
    amount: "₦12,500",
    date: "1 Aug 2026",
    status: "Paid",
  },
  {
    id: "INV-2109",
    plan: "Growth — monthly",
    amount: "₦12,500",
    date: "1 Jul 2026",
    status: "Paid",
  },
  { id: "INV-2001", plan: "Free trial", amount: "₦0", date: "1 Jun 2026", status: "Paid" },
];

export const trendData = [
  { label: "Mon", contacts: 120, leads: 42 },
  { label: "Tue", contacts: 180, leads: 61 },
  { label: "Wed", contacts: 150, leads: 55 },
  { label: "Thu", contacts: 220, leads: 88 },
  { label: "Fri", contacts: 310, leads: 121 },
  { label: "Sat", contacts: 280, leads: 104 },
  { label: "Sun", contacts: 160, leads: 58 },
];

export const sourceData = [
  { label: "Directory profile", value: 41 },
  { label: "QR codes", value: 22 },
  { label: "Campaign links", value: 18 },
  { label: "Contact-gain rooms", value: 12 },
  { label: "Referrals", value: 7 },
];
