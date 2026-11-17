import { useEffect, useState } from "react";
import { toast } from "sonner";
import { db } from "@/lib/shared/kliv-database.js";
import content from "@/lib/shared/kliv-content.js";
import functions from "@/lib/shared/kliv-functions.js";
import { useAuth } from "@/hooks/useAuth";
import { ListingImageFields, imageValue, resolveImage, type ImageValue } from "@/components/provider/ListingImages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CATEGORIES } from "@/lib/roles";
import type { Provider } from "@/lib/providers";
import { DetailFields, detailDraft, priceRows, type DetailDraft } from "@/components/provider/DetailFields";

export type ProviderRow = Provider;

type Form = {
  name: string; category: string; city: string; description: string; price_from: string; rut: boolean;
  avatar: ImageValue; cover: ImageValue; details: DetailDraft;
};

function toForm(p: ProviderRow): Form {
  return {
    name: p.name, category: p.category, city: p.city, description: p.description ?? "",
    price_from: p.price_from != null ? String(p.price_from) : "", rut: !!p.rut,
    avatar: imageValue(p.avatar_path), cover: imageValue(p.cover_path), details: detailDraft(p),
  };
}

/** Listings on the home page. RLS lets only `seniorportalen-admins` update or delete them. */
export default function ProvidersEditor() {
  const { user } = useAuth();
  const [rows, setRows] = useState<ProviderRow[] | null>(null);
  const [editing, setEditing] = useState<ProviderRow | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [deleting, setDeleting] = useState<ProviderRow | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      setRows(await db.query<ProviderRow>("providers", { order: "name.asc" }));
    } catch {
      toast.error("Kunde inte hämta utförare.");
      setRows([]);
    }
  }

  useEffect(() => { load(); }, []);

  function open(p: ProviderRow) { setEditing(p); setForm(toForm(p)); }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editing || !form) return;
    const price = form.price_from.trim() === "" ? null : Number(form.price_from);
    if (price != null && (!Number.isFinite(price) || price < 0)) { toast.error("Ange ett giltigt pris."); return; }
    const prices = priceRows(form.details);
    if (!prices) { toast.error("Kontrollera prislistan: varje rad behöver en tjänst och ett pris."); return; }
    setBusy(true);
    try {
      // Admin uploads skip review and go straight to the public folder.
      const folder = `provider-public/${editing.user_uuid ?? user.userUuid}`;
      const avatar_path = await resolveImage(form.avatar, folder);
      const cover_path = await resolveImage(form.cover, folder);
      await db.updateOne("providers", { _row_id: `eq.${editing._row_id}` }, {
        name: form.name.trim(), category: form.category, city: form.city.trim(),
        description: form.description.trim() || null, price_from: price == null ? null : Math.round(price), rut: form.rut ? 1 : 0,
        ...(editing.user_uuid ? {} : { avatar_path }), cover_path,
        about: form.details.about.trim() || null, service_area: form.details.service_area.trim() || null,
        good_to_know: form.details.good_to_know.trim() || null, cancellation: form.details.cancellation.trim() || null,
        price_list: prices.length ? JSON.stringify(prices) : null,
      });
      if (editing.user_uuid && avatar_path !== editing.avatar_path) {
        // A real provider's face is shared by all their listings; the server changes it everywhere
        // and deletes the old file.
        await functions.post("image-review", { action: "set_avatar", user_uuid: editing.user_uuid, path: avatar_path });
      } else if (!editing.user_uuid && editing.avatar_path && editing.avatar_path !== avatar_path) {
        content.deleteFile(editing.avatar_path).catch(() => {});
      }
      if (editing.cover_path && editing.cover_path !== cover_path) content.deleteFile(editing.cover_path).catch(() => {});
      toast.success("Sparat.");
      setEditing(null);
      await load();
    } catch {
      toast.error("Kunde inte spara.");
    } finally { setBusy(false); }
  }

  async function resetReviews(p: ProviderRow) {
    setBusy(true);
    try {
      await db.updateOne("providers", { _row_id: `eq.${p._row_id}` }, { rating: 0, reviews: 0 });
      toast.success("Omdömena är nollställda. Utföraren visas som ”Ny utförare”.");
      setEditing(null);
      await load();
    } catch {
      toast.error("Kunde inte nollställa.");
    } finally { setBusy(false); }
  }

  async function remove() {
    if (!deleting) return;
    setBusy(true);
    try {
      await db.deleteOne("providers", { _row_id: `eq.${deleting._row_id}` });
      toast.success(`${deleting.name} är borttagen från sajten.`);
      setDeleting(null);
      await load();
    } catch {
      toast.error("Kunde inte ta bort.");
    } finally { setBusy(false); }
  }

  if (rows === null) return <p className="mt-4 text-muted-foreground">Laddar…</p>;

  return (
    <div className="mt-4 space-y-3">
      <p className="text-sm text-muted-foreground">
        Utförarna som visas på startsidan. Utförare markerade ”Testdata” har inget konto kopplat (exempelinlägg).
      </p>
      {rows.length === 0 && <p className="text-muted-foreground">Inga utförare publicerade.</p>}
      <ul className="space-y-3">
        {rows.map((p) => (
          <li key={p._row_id} className="flex flex-col gap-3 rounded-xl border bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-base">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-lg font-bold">{p.name}</span>
                {!p.user_uuid && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Testdata</span>}
              </div>
              <div className="text-muted-foreground">
                {p.category} · {p.city}{p.price_from != null ? ` · från ${p.price_from} kr` : ""}{p.rut ? " · RUT" : ""}
                {p.reviews ? ` · ★ ${(p.rating ?? 0).toFixed(1)} (${p.reviews})` : " · Ny utförare"}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => open(p)}>Redigera</Button>
              <Button variant="destructive" onClick={() => setDeleting(p)}>Ta bort</Button>
            </div>
          </li>
        ))}
      </ul>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Redigera utförare</DialogTitle>
            <DialogDescription>Ändringarna syns direkt på startsidan.</DialogDescription>
          </DialogHeader>
          {form && editing && (
            <form onSubmit={save} className="space-y-4">
              <ListingImageFields idPrefix="p" category={form.category} avatar={form.avatar} cover={form.cover}
                onAvatar={(avatar) => setForm({ ...form, avatar })} onCover={(cover) => setForm({ ...form, cover })} />
              {editing.user_uuid && (
                <p className="text-sm text-muted-foreground">
                  Profilbilden är utförarens egen och visas på alla deras annonser. Byter eller tar du bort den här, ändras den överallt och den gamla bilden raderas.
                </p>
              )}
              <div className="space-y-1">
                <Label htmlFor="p-name">Namn</Label>
                <Input id="p-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="p-category">Kategori</Label>
                  <select id="p-category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="h-10 w-full rounded-md border border-input bg-white px-3">
                    {CATEGORIES.map((c) => <option key={c.name} value={c.name}>{c.icon} {c.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="p-city">Ort</Label>
                  <Input id="p-city" required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="p-price">Pris från (kr)</Label>
                  <Input id="p-price" type="number" min={0} value={form.price_from} onChange={(e) => setForm({ ...form, price_from: e.target.value })} />
                </div>
                <label className="flex items-center gap-2 self-end pb-2">
                  <input type="checkbox" className="h-5 w-5" checked={form.rut} onChange={(e) => setForm({ ...form, rut: e.target.checked })} />
                  RUT-avdrag möjligt
                </label>
              </div>
              <div className="space-y-1">
                <Label htmlFor="p-desc">Beskrivning</Label>
                <Textarea id="p-desc" rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <DetailFields idPrefix="p" value={form.details} onChange={(details) => setForm({ ...form, details })} />
              {!!editing.reviews && (
                <div className="rounded-lg bg-muted p-3 text-sm">
                  Omdömen: ★ {(editing.rating ?? 0).toFixed(1)} ({editing.reviews}). Omdömen kan inte redigeras för hand.
                  <Button type="button" variant="link" className="h-auto p-0 pl-1 text-sm" disabled={busy} onClick={() => resetReviews(editing)}>
                    Nollställ omdömen
                  </Button>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>Avbryt</Button>
                <Button type="submit" disabled={busy}>{busy ? "Sparar…" : "Spara"}</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ta bort {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>Utföraren försvinner från startsidan. Det går inte att ångra.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={(e) => { e.preventDefault(); remove(); }}>Ta bort</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
