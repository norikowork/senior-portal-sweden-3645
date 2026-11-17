/** Seniorportalen's own admin group. Not sverige.jp's `site-admins`: the two are separate companies. */
export const ADMIN_GROUP = "seniorportalen-admins";

/** Home-page hero photo, in the public site image folder. Only admins may replace it (/admin or the
 *  Kliv file manager). */
export const HERO_IMAGE = "/content/site/images/hero.jpg";

/** Groups arrive as objects from the session endpoints and as bare keys elsewhere. UI hint only:
 *  RLS and the provider-review function enforce admin access on the server. */
export function isAdmin(user: { groups?: Array<string | { key?: string }> } | null | undefined): boolean {
  return !!user?.groups?.some((g) => (typeof g === "string" ? g : g?.key) === ADMIN_GROUP);
}

export const CATEGORIES = [
  { name: "Städning", icon: "🧹" }, { name: "Trädgård", icon: "🌿" },
  { name: "Hantverkare", icon: "🔧" }, { name: "Flytthjälp", icon: "📦" },
  { name: "Hemtjänst", icon: "🤝" }, { name: "IT-hjälp", icon: "💻" },
  { name: "Matleverans", icon: "🍲" },
];

/** Swedish VAT number: SE + 10-digit organisation/person number (Luhn) + 01. Mirrors provider-apply. */
export function isValidSwedishVat(raw: string): boolean {
  const s = raw.toUpperCase().replace(/[\s-]/g, "").replace(/^SE/, "");
  if (!/^\d{12}$/.test(s) || !s.endsWith("01")) return false;
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    let d = Number(s[i]);
    if (i % 2 === 0) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return sum % 10 === 0;
}
