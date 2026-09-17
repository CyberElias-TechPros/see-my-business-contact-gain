/**
 * A deterministic colour pair derived from the business id.
 *
 * The product has no photography pipeline, so every listing gets a stable,
 * ownable cover instead of a stock placeholder or a grey box. Same id always
 * produces the same art, so the card is recognisable across visits.
 */
export function businessIdentity(id: string): {
  hue: number;
  hue2: number;
  initials: string;
} {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) | 0;
  }
  const positive = Math.abs(hash);
  return {
    hue: 118 + (positive % 150),
    hue2: (positive >> 5) % 120,
    initials: (id.replace(/[^a-z]/gi, "").slice(0, 2) || "GH").toUpperCase(),
  };
}
