import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { parsePriceList, type Provider } from "@/lib/providers";

export type PriceDraft = { name: string; price: string; unit: string };
export type DetailDraft = {
  about: string; service_area: string; good_to_know: string; cancellation: string; prices: PriceDraft[];
};

export function detailDraft(p: Provider): DetailDraft {
  return {
    about: p.about ?? "", service_area: p.service_area ?? "", good_to_know: p.good_to_know ?? "",
    cancellation: p.cancellation ?? "",
    prices: parsePriceList(p.price_list).map((r) => ({ name: r.name, price: String(r.price), unit: r.unit })),
  };
}

/** Rows with both a name and a valid price; blank rows are dropped. Returns null if a row is half-filled. */
export function priceRows(d: DetailDraft): { name: string; price: number; unit: string }[] | null {
  const rows = [];
  for (const r of d.prices) {
    const name = r.name.trim();
    if (!name && !r.price.trim()) continue;
    const price = Number(r.price);
    if (!name || r.price.trim() === "" || !Number.isFinite(price) || price < 0) return null;
    rows.push({ name, price: Math.round(price), unit: r.unit.trim() });
  }
  return rows;
}

export function DetailFields({ idPrefix, value, onChange }: {
  idPrefix: string; value: DetailDraft; onChange: (v: DetailDraft) => void;
}) {
  const set = (patch: Partial<DetailDraft>) => onChange({ ...value, ...patch });
  const setRow = (i: number, patch: Partial<PriceDraft>) =>
    set({ prices: value.prices.map((r, j) => (j === i ? { ...r, ...patch } : r)) });

  return (
    <div className="space-y-5 rounded-lg border border-dashed p-4">
      <div className="text-base font-semibold">Detaljsidan</div>
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-about`} className="text-base">Om oss</Label>
        <Textarea id={`${idPrefix}-about`} rows={4} className="text-base" placeholder="Presentera dig: vem du är, hur länge du arbetat och vad kunderna kan förvänta sig."
          value={value.about} onChange={(e) => set({ about: e.target.value })} />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-base font-medium">Prislista</legend>
        <p className="text-sm text-muted-foreground">Pris inklusive moms. Enhet t.ex. ”/tim”, ”/st” eller ”/tillfälle”.</p>
        {value.prices.map((r, i) => (
          <div key={i} className="grid grid-cols-[1fr_6rem_6rem_auto] items-center gap-2">
            <Input aria-label={`Tjänst ${i + 1}`} placeholder="Tjänst" value={r.name} onChange={(e) => setRow(i, { name: e.target.value })} />
            <Input aria-label={`Pris ${i + 1}`} placeholder="Pris" type="number" min={0} value={r.price} onChange={(e) => setRow(i, { price: e.target.value })} />
            <Input aria-label={`Enhet ${i + 1}`} placeholder="/tim" value={r.unit} onChange={(e) => setRow(i, { unit: e.target.value })} />
            <Button type="button" variant="ghost" size="sm" aria-label={`Ta bort rad ${i + 1}`}
              onClick={() => set({ prices: value.prices.filter((_, j) => j !== i) })}>✕</Button>
          </div>
        ))}
        {value.prices.length < 12 && (
          <Button type="button" variant="outline" size="sm" onClick={() => set({ prices: [...value.prices, { name: "", price: "", unit: "" }] })}>
            + Lägg till rad
          </Button>
        )}
      </fieldset>

      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-area`} className="text-base">Område</Label>
        <Input id={`${idPrefix}-area`} placeholder="T.ex. Malmö, Lund och Staffanstorp" value={value.service_area} onChange={(e) => set({ service_area: e.target.value })} />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-good`} className="text-base">Bra att veta</Label>
        <Textarea id={`${idPrefix}-good`} rows={3} className="text-base" placeholder="T.ex. vad kunden ska förbereda, vad som ingår och vad som kostar extra."
          value={value.good_to_know} onChange={(e) => set({ good_to_know: e.target.value })} />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-cancel`} className="text-base">Avbokning</Label>
        <Textarea id={`${idPrefix}-cancel`} rows={2} className="text-base" placeholder="T.ex. Kostnadsfri avbokning senast 24 timmar innan."
          value={value.cancellation} onChange={(e) => set({ cancellation: e.target.value })} />
      </div>
    </div>
  );
}
