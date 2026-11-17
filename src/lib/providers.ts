/** A public listing (row in `providers`). Everything here is readable by anyone. */
export type Provider = {
  _row_id: number; name: string; category: string; city: string;
  description: string | null; price_from: number | null; rating: number | null; reviews: number | null; rut: number;
  user_uuid: string | null; avatar_path: string | null; cover_path: string | null;
  about: string | null; price_list: string | null; service_area: string | null;
  good_to_know: string | null; cancellation: string | null;
  _updated_at?: number;
};

export type PriceRow = { name: string; price: number; unit: string };

export function parsePriceList(raw: string | null | undefined): PriceRow[] {
  if (!raw) return [];
  try {
    const rows = JSON.parse(raw) as unknown;
    return Array.isArray(rows)
      ? rows.filter((r): r is PriceRow => !!r && typeof r.name === "string" && typeof r.price === "number")
      : [];
  } catch {
    return [];
  }
}

/** "/tim" for hourly work, "/portion" for meals. */
export function priceUnit(category: string): string {
  return category === "Matleverans" ? "/portion" : "/tim";
}

export function providerPath(p: { _row_id: number | string }): string {
  return `/utforare/${p._row_id}`;
}

export function formatKr(n: number): string {
  return `${n.toLocaleString("sv-SE")} kr`;
}
