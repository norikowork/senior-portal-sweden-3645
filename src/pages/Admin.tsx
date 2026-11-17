import { useEffect, useState } from "react";
import { toast } from "sonner";
import { db } from "@/lib/shared/kliv-database.js";
import functions from "@/lib/shared/kliv-functions.js";
import content from "@/lib/shared/kliv-content.js";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { HERO_IMAGE, isAdmin } from "@/lib/roles";
import { STATUS_LABEL, type Application } from "./BecomeProvider";
import { formatDate, type ServiceRequest } from "./MyPages";
import ProvidersEditor, { type ProviderRow } from "@/components/admin/ProvidersEditor";
import ImageReviews, { type ReviewWithNames } from "@/components/admin/ImageReviews";
import type { ImageReview } from "@/components/provider/ListingImages";

function HeroUpload() {
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(() => Date.now());

  async function upload(file: File | undefined) {
    if (!file) return;
    if (file.type !== "image/jpeg") { toast.error("Välj en JPEG-bild (.jpg)."); return; }
    if (file.size > 15 * 1024 * 1024) { toast.error("Bilden är för stor (max 15 MB)."); return; }
    setBusy(true);
    try {
      const uploaded = await content.uploadFile(file, "site/uploads");
      await content.deleteFile(HERO_IMAGE).catch(() => undefined);
      await content.moveFile(uploaded.path, HERO_IMAGE);
      setVersion(Date.now());
      toast.success("Startsidans bild är uppdaterad.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Uppladdningen misslyckades.");
    } finally { setBusy(false); }
  }

  return (
    <div className="mt-4 space-y-4 rounded-2xl border bg-white p-5">
      <h2 className="text-xl font-bold">Startsidans bild</h2>
      <p className="text-sm text-muted-foreground">Visas bakom rubriken ”Hjälp i vardagen”. JPEG, gärna minst 1600 px bred. Servern skapar mindre versioner för mobilen automatiskt.</p>
      <img src={`${HERO_IMAGE}?w=640&v=${version}`} alt="Nuvarande bild" className="w-full max-w-md rounded-xl border"
        onError={(e) => { e.currentTarget.style.display = "none"; }} onLoad={(e) => { e.currentTarget.style.display = ""; }} />
      <label className="block">
        <span className="sr-only">Välj bild</span>
        <input type="file" accept="image/jpeg" disabled={busy} onChange={(e) => upload(e.target.files?.[0])} className="text-base" />
      </label>
      {busy && <p className="text-sm text-muted-foreground">Laddar upp…</p>}
    </div>
  );
}

const VAT_LABEL: Record<string, string> = {
  verified: "✅ Bekräftat i VIES", unverified: "⚠️ VIES svarade inte – kontrollera manuellt", unchecked: "Ej kontrollerat",
};

function ApplicationCard({ a, onDone }: { a: Application; onDone: () => void }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function review(decision: "approve" | "reject") {
    if (decision === "reject" && !note.trim()) { toast.error("Skriv en kommentar till sökanden."); return; }
    setBusy(true);
    try {
      await functions.post("provider-review", { id: a._row_id, decision, note });
      toast.success(decision === "approve" ? "Godkänd och publicerad." : "Ansökan avslagen.");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Något gick fel.");
    } finally { setBusy(false); }
  }

  return (
    <li className="rounded-2xl border bg-white p-5 text-base">
      <div className="flex flex-col gap-5 sm:flex-row">
        <a href={a.photo_path} target="_blank" rel="noreferrer" className="shrink-0">
          <img src={`${a.photo_path}?w=320`} alt={`Foto på ${a.contact_name}`} className="h-36 w-36 rounded-xl border object-cover" />
        </a>
        <div className="flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xl font-bold">{a.company_name}</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-sm">{STATUS_LABEL[a.status] ?? a.status}</span>
          </div>
          <div>{a.contact_name} · <a href={`tel:${a.phone}`} className="text-primary underline">{a.phone}</a></div>
          <div>{a.category} · {a.city}{a.price_from != null ? ` · från ${a.price_from} kr` : ""}{a.rut ? " · RUT" : ""}</div>
          <div><span className="font-semibold">Moms-nr:</span> {a.vat_number} – {VAT_LABEL[a.vat_status] ?? a.vat_status}
            {a.vat_registered_name ? ` (registrerat namn: ${a.vat_registered_name})` : ""}</div>
          {a.description && <p className="whitespace-pre-wrap text-muted-foreground">{a.description}</p>}
          <div className="text-sm text-muted-foreground">Inskickad {formatDate(a._created_at)}</div>
          {a.photo_updated_at && (
            <div className="text-sm font-semibold text-amber-700">Fotot byttes av utföraren {formatDate(a.photo_updated_at)} – kontrollera det.</div>
          )}
          {a.review_note && <div className="text-sm">Kommentar: {a.review_note}</div>}
        </div>
      </div>
      {a.status === "pending" && (
        <div className="mt-4 space-y-2">
          <Textarea placeholder="Kommentar (krävs vid avslag, visas för sökanden)" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex gap-2">
            <Button disabled={busy} onClick={() => review("approve")}>Godkänn och publicera</Button>
            <Button disabled={busy} variant="destructive" onClick={() => review("reject")}>Avslå</Button>
          </div>
        </div>
      )}
    </li>
  );
}

export default function Admin() {
  const { user, loading } = useAuth();
  const [apps, setApps] = useState<Application[]>([]);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [images, setImages] = useState<ReviewWithNames[]>([]);
  const admin = isAdmin(user);

  async function load() {
    const [a, r, i, p] = await Promise.all([
      db.query<Application>("provider_applications", { order: "_created_at.desc" }),
      db.query<ServiceRequest>("requests", { order: "_created_at.desc", limit: 200 }),
      db.query<ImageReview>("image_reviews", { status: "eq.pending", order: "_created_at.asc" }),
      db.query<ProviderRow>("providers", {}),
    ]);
    setApps(a); setRequests(r);
    setImages(i.map((img) => {
      const owner = a.find((x) => x.user_uuid === img.user_uuid && x.status === "approved");
      return {
        ...img,
        providerName: owner ? `${owner.contact_name} (${owner.company_name})` : undefined,
        listingName: p.find((x) => x._row_id === img.provider_id)?.name,
      };
    }));
  }

  useEffect(() => {
    document.title = "Admin – Seniorportalen";
    if (admin) load().catch(() => toast.error("Kunde inte hämta data."));
  }, [admin]);

  if (loading) return null;
  if (!admin) {
    return <div className="mx-auto max-w-2xl px-4 py-16 text-center text-lg">Du har inte behörighet till den här sidan.</div>;
  }

  const pending = apps.filter((a) => a.status === "pending");
  const handled = apps.filter((a) => a.status !== "pending");

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-bold">Admin</h1>
      <Tabs defaultValue="pending" className="mt-6">
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="pending">Att granska ({pending.length})</TabsTrigger>
          <TabsTrigger value="handled">Behandlade ({handled.length})</TabsTrigger>
          <TabsTrigger value="images">Bilder att granska ({images.length})</TabsTrigger>
          <TabsTrigger value="providers">Utförare</TabsTrigger>
          <TabsTrigger value="requests">Förfrågningar ({requests.length})</TabsTrigger>
          <TabsTrigger value="site">Webbplats</TabsTrigger>
        </TabsList>
        <TabsContent value="pending">
          {pending.length === 0 ? <p className="mt-4 text-muted-foreground">Inga ansökningar att granska.</p> : (
            <ul className="mt-4 space-y-4">{pending.map((a) => <ApplicationCard key={a._row_id} a={a} onDone={load} />)}</ul>
          )}
        </TabsContent>
        <TabsContent value="images">
          <ImageReviews reviews={images} onDone={() => load().catch(() => toast.error("Kunde inte hämta data."))} />
        </TabsContent>
        <TabsContent value="handled">
          <ul className="mt-4 space-y-4">{handled.map((a) => <ApplicationCard key={a._row_id} a={a} onDone={load} />)}</ul>
        </TabsContent>
        <TabsContent value="requests">
          <ul className="mt-4 space-y-3">
            {requests.map((r) => (
              <li key={r._row_id} className="rounded-xl border bg-white p-4">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-semibold">{r.service}</span>
                  <span className="text-sm text-muted-foreground">{formatDate(r._created_at)}</span>
                </div>
                <div>{r.name} · {r.phone}{r.city ? ` · ${r.city}` : ""}</div>
                {r.message && <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{r.message}</p>}
              </li>
            ))}
          </ul>
        </TabsContent>
        <TabsContent value="providers">
          <ProvidersEditor />
        </TabsContent>
        <TabsContent value="site">
          <HeroUpload />
        </TabsContent>
      </Tabs>
    </div>
  );
}
