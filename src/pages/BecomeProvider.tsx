import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { db } from "@/lib/shared/kliv-database.js";
import content from "@/lib/shared/kliv-content.js";
import functions from "@/lib/shared/kliv-functions.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { CATEGORIES, isValidSwedishVat } from "@/lib/roles";
import { MAX_PICK_BYTES, optimizeImage } from "@/lib/imageUpload";

export type Application = {
  _row_id: number; user_uuid: string; contact_name: string; company_name: string; vat_number: string; vat_status: string;
  vat_registered_name: string | null; category: string; city: string; description: string | null;
  price_from: number | null; rut: number; phone: string; photo_path: string; status: string;
  review_note: string | null; _created_at: number; photo_updated_at?: number | null;
};

export const STATUS_LABEL: Record<string, string> = {
  pending: "Under granskning", approved: "Godkänd och publicerad", rejected: "Inte godkänd",
};

const EMPTY = { contact_name: "", company_name: "", vat_number: "", category: "", city: "", description: "", price_from: "", phone: "", rut: false };

export default function BecomeProvider() {
  const { user } = useAuth();
  const [apps, setApps] = useState<Application[] | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      setApps(await db.query<Application>("provider_applications", { user_uuid: `eq.${user.userUuid}`, order: "_created_at.desc" }));
    } catch {
      setApps([]);
    }
  }

  useEffect(() => {
    document.title = "Bli utförare – Seniorportalen";
    if (user?.userUuid) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.userUuid]);

  useEffect(() => {
    if (!user) return;
    setForm((f) => ({ ...f, contact_name: f.contact_name || [user.firstName, user.lastName].filter(Boolean).join(" ") }));
  }, [user]);

  function pickPhoto(file: File | null) {
    if (preview) URL.revokeObjectURL(preview);
    if (file && !file.type.startsWith("image/")) { toast.error("Välj en bildfil."); return; }
    if (file && file.size > MAX_PICK_BYTES) { toast.error("Bilden är för stor (max 30 MB)."); return; }
    setPhoto(file);
    setPreview(file ? URL.createObjectURL(file) : "");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!photo) { toast.error("Ladda upp ett foto på ditt ansikte."); return; }
    if (!form.category) { toast.error("Välj en kategori."); return; }
    if (!isValidSwedishVat(form.vat_number)) {
      toast.error("Momsregistreringsnumret ser inte rätt ut. Exempel: SE556677889901.");
      return;
    }
    setBusy(true);
    try {
      const uploaded = await content.uploadFile(await optimizeImage(photo), `provider-photos/${user.userUuid}`);
      const res = await functions.post<{ vat_status: string }>("provider-apply", {
        ...form, price_from: form.price_from ? Number(form.price_from) : null, photo_path: uploaded.path,
      });
      toast.success(res.vat_status === "verified"
        ? "Tack! Momsnumret är bekräftat och din ansökan granskas nu."
        : "Tack! Din ansökan granskas nu. Vi kontrollerar momsnumret manuellt.");
      setForm(EMPTY); pickPhoto(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Något gick fel, försök igen.");
    } finally {
      setBusy(false);
    }
  }

  const open = apps?.find((a) => a.status === "pending" || a.status === "approved");
  const latest = apps?.[0];

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 text-lg">
      <h1 className="text-3xl font-bold">Bli utförare</h1>
      <p className="mt-2 text-base text-muted-foreground">
        Erbjud dina tjänster till seniorer i ditt område. Alla utförare granskas av oss innan de visas på sajten.
      </p>

      {apps === null && <p className="mt-8 text-base text-muted-foreground">Laddar…</p>}

      {open && (
        <div className="mt-8 rounded-2xl border bg-white p-6">
          <div className="text-sm font-semibold uppercase text-muted-foreground">Din ansökan</div>
          <div className="mt-1 text-2xl font-bold">{open.company_name}</div>
          <div className={`mt-2 inline-block rounded-full px-3 py-1 text-base font-semibold ${open.status === "approved" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
            {STATUS_LABEL[open.status]}
          </div>
          <p className="mt-3 text-base text-muted-foreground">
            {open.status === "approved"
              ? "Du syns nu på startsidan. Förfrågningar till dig hittar du under Mina sidor."
              : "Vi granskar ditt foto och ditt momsregistreringsnummer. Du ser resultatet här och under Mina sidor."}
          </p>
          <Button asChild variant="outline" className="mt-4 text-base"><Link to="/mina-sidor">Till Mina sidor</Link></Button>
        </div>
      )}

      {apps !== null && !open && (
        <>
          {latest?.status === "rejected" && (
            <div className="mt-8 rounded-2xl border border-destructive/40 bg-destructive/5 p-5 text-base">
              <div className="font-semibold">Din förra ansökan godkändes inte.</div>
              {latest.review_note && <div className="mt-1">Kommentar: {latest.review_note}</div>}
              <div className="mt-1 text-muted-foreground">Du kan rätta uppgifterna och skicka in en ny ansökan nedan.</div>
            </div>
          )}

          <form onSubmit={submit} className="mt-8 space-y-6 rounded-2xl border bg-white p-6">
            <div className="space-y-2">
              <Label htmlFor="photo" className="text-base font-semibold">Foto på ditt ansikte *</Label>
              <p className="text-sm text-muted-foreground">Ett tydligt foto där ansiktet syns. Under granskningen ser bara du och Seniorportalens granskare det. När du blivit godkänd blir det din profilbild på dina annonser – du kan byta den under din profil.</p>
              <div className="flex items-center gap-4">
                <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-dashed bg-muted">
                  {preview ? <img src={preview} alt="Förhandsvisning av ditt foto" className="h-full w-full object-cover" /> : <span className="text-4xl">🙂</span>}
                </div>
                <Input id="photo" type="file" accept="image/*" capture="user" className="text-base"
                  onChange={(e) => pickPhoto(e.target.files?.[0] ?? null)} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contact_name" className="text-base">Ditt namn *</Label>
                <Input id="contact_name" required className="h-12 text-base" value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_name" className="text-base">Företagsnamn (visas på sajten) *</Label>
                <Input id="company_name" required className="h-12 text-base" value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="vat" className="text-base">Momsregistreringsnummer *</Label>
              <Input id="vat" required placeholder="SE556677889901" className="h-12 text-base uppercase" value={form.vat_number} onChange={(e) => setForm({ ...form, vat_number: e.target.value })} />
              <p className="text-sm text-muted-foreground">Vi kontrollerar numret mot EU:s momsregister (VIES). Numret visas inte offentligt.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="category" className="text-base">Kategori *</Label>
                <select id="category" required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="h-12 w-full rounded-md border border-input bg-white px-3 text-base">
                  <option value="">Välj…</option>
                  {CATEGORIES.map((c) => <option key={c.name} value={c.name}>{c.icon} {c.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="city" className="text-base">Ort *</Label>
                <Input id="city" required className="h-12 text-base" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-base">Telefonnummer *</Label>
                <Input id="phone" required type="tel" className="h-12 text-base" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price" className="text-base">Pris från (kr)</Label>
                <Input id="price" type="number" min={0} className="h-12 text-base" value={form.price_from} onChange={(e) => setForm({ ...form, price_from: e.target.value })} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-base">Beskriv dina tjänster</Label>
              <Textarea id="description" rows={4} className="text-base" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>

            <label className="flex items-center gap-3 text-base">
              <input type="checkbox" className="h-5 w-5" checked={form.rut} onChange={(e) => setForm({ ...form, rut: e.target.checked })} />
              RUT-avdrag möjligt
            </label>

            <Button type="submit" size="lg" className="w-full text-lg" disabled={busy}>{busy ? "Skickar…" : "Skicka ansökan"}</Button>
          </form>
        </>
      )}
    </div>
  );
}
