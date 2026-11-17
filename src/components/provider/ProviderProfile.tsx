import { useEffect, useState } from "react";
import { toast } from "sonner";
import { db } from "@/lib/shared/kliv-database.js";
import content from "@/lib/shared/kliv-content.js";
import functions from "@/lib/shared/kliv-functions.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { CATEGORIES } from "@/lib/roles";
import { MAX_PICK_BYTES, optimizeImage } from "@/lib/imageUpload";
import { STATUS_LABEL, type Application } from "@/pages/BecomeProvider";
import type { ProviderRow } from "@/components/admin/ProvidersEditor";
import { Link } from "react-router-dom";
import { providerPath } from "@/lib/providers";
import { DetailFields, detailDraft, priceRows } from "./DetailFields";
import { ListingImageFields, ReviewNotice, imageValue, resolveImage, type ImageReview, type ImageValue } from "./ListingImages";

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : "Något gick fel, försök igen.";
}

/** The newest review for one photo slot (avatar, or the cover of one listing). */
function latestReview(reviews: ImageReview[], kind: ImageReview["kind"], providerId: number | null) {
  return reviews.find((r) => r.kind === kind && r.provider_id === providerId);
}

function ListingForm({ row, userUuid, review, onSaved }: {
  row: ProviderRow; userUuid: string; review: ImageReview | undefined; onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: row.name, category: row.category, city: row.city, description: row.description ?? "",
    price_from: row.price_from != null ? String(row.price_from) : "", rut: !!row.rut,
  });
  const [cover, setCover] = useState<ImageValue>(imageValue(row.cover_path));
  const [details, setDetails] = useState(() => detailDraft(row));
  const [busy, setBusy] = useState(false);
  const id = `l${row._row_id}`;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const prices = priceRows(details);
    if (!prices) { toast.error("Kontrollera prislistan: varje rad behöver en tjänst och ett pris."); return; }
    setBusy(true);
    try {
      const cover_path = await resolveImage(cover, `provider-photos/${userUuid}`);
      const res = await functions.post<{ review: boolean }>("provider-profile", {
        action: "listing", listing_id: row._row_id, ...form,
        price_from: form.price_from.trim() === "" ? null : Number(form.price_from), cover_path,
        about: details.about, service_area: details.service_area, good_to_know: details.good_to_know,
        cancellation: details.cancellation, price_list: prices,
      });
      toast.success(res.review
        ? "Annonsen är sparad. Den nya bilden visas när Seniorportalen har godkänt den."
        : "Annonsen är sparad och syns direkt på startsidan.");
      onSaved();
    } catch (err) {
      toast.error(errorText(err));
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={save} className="space-y-5 rounded-lg border bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-lg font-bold">{row.name}</div>
        <Link to={providerPath(row)} className="text-base font-semibold text-primary underline">Visa din sida</Link>
      </div>
      <ListingImageFields idPrefix={id} category={form.category} cover={cover} onCover={setCover} />
      <ReviewNotice review={review} />
      <div className="space-y-1">
        <Label htmlFor={`${id}-name`} className="text-base">Företagsnamn (visas på sajten)</Label>
        <Input id={`${id}-name`} required className="h-11 text-base" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`${id}-category`} className="text-base">Kategori</Label>
          <select id={`${id}-category`} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="h-11 w-full rounded-md border border-input bg-white px-3 text-base">
            {CATEGORIES.map((c) => <option key={c.name} value={c.name}>{c.icon} {c.name}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${id}-city`} className="text-base">Ort</Label>
          <Input id={`${id}-city`} required className="h-11 text-base" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${id}-price`} className="text-base">Pris från (kr)</Label>
          <Input id={`${id}-price`} type="number" min={0} className="h-11 text-base" value={form.price_from} onChange={(e) => setForm({ ...form, price_from: e.target.value })} />
        </div>
        <label className="flex items-center gap-2 self-end pb-2 text-base">
          <input type="checkbox" className="h-5 w-5" checked={form.rut} onChange={(e) => setForm({ ...form, rut: e.target.checked })} />
          RUT-avdrag möjligt
        </label>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${id}-desc`} className="text-base">Beskriv dina tjänster</Label>
        <Textarea id={`${id}-desc`} rows={4} className="text-base" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </div>
      <DetailFields idPrefix={id} value={details} onChange={setDetails} />
      <Button type="submit" disabled={busy}>{busy ? "Sparar…" : "Spara annonsen"}</Button>
    </form>
  );
}

/** Shown on the profile page for users with a pending or approved provider application. */
export default function ProviderProfile() {
  const { user } = useAuth();
  const uuid: string | undefined = user?.userUuid;
  const [app, setApp] = useState<Application | null>(null);
  const [listings, setListings] = useState<ProviderRow[]>([]);
  const [reviews, setReviews] = useState<ImageReview[]>([]);
  const [contact, setContact] = useState({ contact_name: "", phone: "" });
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!uuid) return;
    Promise.all([
      db.query<Application>("provider_applications", { user_uuid: `eq.${uuid}`, order: "_created_at.desc" }),
      db.query<ProviderRow>("providers", { user_uuid: `eq.${uuid}`, order: "name.asc" }),
      db.query<ImageReview>("image_reviews", { user_uuid: `eq.${uuid}`, order: "_created_at.desc", limit: 50 }),
    ]).then(([apps, l, r]) => {
      setReviews(r);
      const active = apps.find((a) => a.status === "pending" || a.status === "approved") ?? null;
      setApp(active);
      setListings(l);
      if (active) setContact({ contact_name: active.contact_name, phone: active.phone });
    }).catch(() => {});
  }, [uuid, version]);

  useEffect(() => {
    if (!photo) { setPhotoPreview(""); return; }
    const url = URL.createObjectURL(photo);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  if (!app || !uuid) return null;

  async function saveContact(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await functions.post("provider-profile", { action: "contact", ...contact });
      toast.success("Kontaktuppgifterna är sparade.");
      setVersion((v) => v + 1);
    } catch (err) { toast.error(errorText(err)); } finally { setBusy(false); }
  }

  async function savePhoto() {
    if (!photo) return;
    setBusy(true);
    try {
      // Always private first: an admin approves it before it appears on the site.
      const uploaded = await content.uploadFile(await optimizeImage(photo), `provider-photos/${uuid}`);
      const res = await functions.post<{ review: boolean }>("provider-profile", { action: "photo", photo_path: uploaded.path });
      toast.success(res.review
        ? "Tack! Profilbilden granskas och byts på alla dina annonser när den godkänts."
        : "Profilbilden är bytt.");
      setPhoto(null);
      setVersion((v) => v + 1);
    } catch (err) { toast.error(errorText(err)); } finally { setBusy(false); }
  }

  return (
    <section className="rounded-lg border border-border bg-card p-6 shadow-xs">
      <h2 className="text-lg font-semibold text-foreground">Utförarprofil</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {app.company_name} – {STATUS_LABEL[app.status] ?? app.status}
      </p>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <div className="text-base font-semibold">Profilbild</div>
          <p className="text-sm text-muted-foreground">
            {app.status === "approved"
              ? "Ett foto på ditt ansikte. Visas på alla dina annonser, så du behöver bara ladda upp det här. Nya bilder granskas innan de visas."
              : "Ett foto på ditt ansikte. Det granskas först och visas på dina annonser när du blivit godkänd."}
          </p>
          <div className="flex flex-wrap items-center gap-4">
            {photoPreview || app.photo_path ? (
              <img src={photoPreview || `${app.photo_path}?w=320`} alt="Din profilbild"
                className="h-24 w-24 rounded-full border object-cover" />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-dashed bg-muted text-3xl">🙂</div>
            )}
            <div className="flex flex-col gap-2">
              <input type="file" accept="image/*" capture="user" aria-label="Välj ny profilbild" className="text-sm"
                onChange={(e) => { const f = e.target.files?.[0]; if (f && f.type.startsWith("image/") && f.size <= MAX_PICK_BYTES) setPhoto(f); e.target.value = ""; }} />
              {photo && <Button type="button" size="sm" disabled={busy} onClick={savePhoto}>{busy ? "Sparar…" : "Spara profilbilden"}</Button>}
            </div>
          </div>
          <ReviewNotice review={latestReview(reviews, "avatar", null)} />
        </div>

        <form onSubmit={saveContact} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="pp-contact">Ditt namn</Label>
            <Input id="pp-contact" required value={contact.contact_name} onChange={(e) => setContact({ ...contact, contact_name: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pp-phone">Telefonnummer</Label>
            <Input id="pp-phone" required type="tel" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} />
          </div>
          <Button type="submit" variant="outline" disabled={busy}>Spara kontaktuppgifter</Button>
        </form>
      </div>

      {listings.length > 0 && (
        <div className="mt-8 space-y-4">
          <h3 className="text-base font-semibold">Dina annonser på startsidan</h3>
          {listings.map((l) => (
            <ListingForm key={`${l._row_id}-${l._updated_at ?? ""}`} row={l} userUuid={uuid}
              review={latestReview(reviews, "cover", l._row_id)} onSaved={() => setVersion((v) => v + 1)} />
          ))}
        </div>
      )}
    </section>
  );
}
