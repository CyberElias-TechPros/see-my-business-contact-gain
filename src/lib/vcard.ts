import type { Business, ListMember, PersonListing } from "@/lib/types";

/**
 * Free-tier exports: everything is generated client-side as Blobs — no
 * server-side rendering service, no paid APIs.
 */

function download(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const digits = (n: string) => n.replace(/\D/g, "");

/** Escape per RFC 6350 basic rules. */
const vesc = (v: string) => v.replace(/\\/g, "\\\\").replace(/[\n,;]/g, (c) => `\\${c}`);

/** Single-business vCard (RFC 6350). */
export function buildVCard(
  business: Pick<Business, "name" | "whatsapp" | "phone" | "website" | "address">,
): string {
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${vesc(business.name)}`,
    `ORG:${vesc(business.name)}`,
  ];
  if (business.whatsapp) lines.push(`TEL;TYPE=CELL,VOICE:${digits(business.whatsapp)}`);
  if (business.phone) lines.push(`TEL;TYPE=WORK,VOICE:${digits(business.phone)}`);
  lines.push(`ADR;TYPE=WORK:;;${vesc(business.address)};;;;`);
  if (business.website) lines.push(`URL:${business.website}`);
  lines.push("NOTE:Contact from GainHub NG business directory");
  lines.push("END:VCARD");
  return lines.join("\r\n");
}

export function downloadBusinessVCard(
  business: Pick<Business, "id" | "name" | "whatsapp" | "phone" | "website" | "address">,
) {
  download(buildVCard(business), `${business.id}.vcf`, "text/vcard");
  return `${business.id}.vcf`;
}

const csvCell = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;

/** Contact-list export (opens in Excel / Google Sheets). */
export function downloadListCsv(name: string, members: ListMember[]) {
  const header = [
    "Business",
    "Category",
    "City",
    "State",
    "WhatsApp",
    "Phone",
    "Website",
    "Status",
    "Tags",
    "Notes",
    "Source",
    "Date added",
  ];
  const rows = members.map((m) =>
    [
      m.business.name,
      m.business.categorySlug,
      m.business.city,
      m.business.state,
      m.business.whatsapp,
      m.business.phone,
      m.business.website,
      m.status,
      m.tags.join(" "),
      m.note,
      m.source,
      new Date(Date.now() - m.ts * 60_000).toISOString().slice(0, 10),
    ]
      .map(csvCell)
      .join(","),
  );
  download([header.map(csvCell).join(","), ...rows].join("\r\n"), `${name}.csv`, "text/csv");
}

/** Personal-listing export. */
export function downloadListingsCsv(listings: PersonListing[]) {
  const header = ["Name", "Category", "State", "WhatsApp", "Bio", "Adds"];
  const rows = listings.map((l) =>
    [l.displayName, l.category, l.state, l.whatsapp, l.bio, String(l.adds)].map(csvCell).join(","),
  );
  download(
    [header.map(csvCell).join(","), ...rows].join("\r\n"),
    "gainhub-listings.csv",
    "text/csv",
  );
}
