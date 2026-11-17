import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "@/lib/shared/kliv-database.js";
import { contentImage } from "@/lib/shared/kliv-content.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { CATEGORIES, HERO_IMAGE } from "@/lib/roles";
import { ListingPhotos } from "@/components/provider/ListingImages";
import { useRequestDialog } from "@/components/provider/RequestDialog";
import { priceUnit, providerPath, type Provider } from "@/lib/providers";

export default function Index() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [cat, setCat] = useState<string>("");
  const [q, setQ] = useState("");
  const request = useRequestDialog("/");

  useEffect(() => {
    document.title = "Seniorportalen – hjälp i vardagen nära dig";
    db.query<Provider>("providers", { order: "rating.desc" }).then(setProviders).catch(() => toast.error("Kunde inte hämta tjänster"));
  }, []);

  const shown = providers.filter(
    (p) => (!cat || p.category === cat) && (!q || (p.city + p.name + p.category).toLowerCase().includes(q.toLowerCase()))
  );

  return (
    <div className="text-lg">
      <section className="relative isolate overflow-hidden bg-primary text-primary-foreground">
        {/* Uploaded by an admin at /admin. The people should sit right of the headline; the server
            serves resized copies via ?w=. Hidden if not uploaded yet (plain green). */}
        <img
          {...contentImage(HERO_IMAGE, { widths: [640, 960, 1280, 1920], sizes: "100vw" })}
          width={1672} height={941} alt="" aria-hidden="true" fetchPriority="high" decoding="async"
          onError={(e) => { e.currentTarget.style.display = "none"; }}
          className="absolute inset-0 -z-20 h-full w-full object-cover object-[50%_30%]"
        />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-primary/80 md:bg-transparent md:bg-gradient-to-r md:from-primary md:from-25% md:via-primary/75 md:via-50% md:to-primary/10" />
        <div className="mx-auto max-w-6xl px-4 py-16 md:py-28 [text-shadow:0_1px_3px_rgb(0_0_0/0.35)]">
          <h1 className="max-w-2xl text-4xl font-bold leading-tight md:text-5xl">Hjälp i vardagen – av personer du kan lita på</h1>
          <p className="mt-4 max-w-xl text-xl opacity-90">Hitta lokala tjänster inom städning, trädgård, omsorg och mycket mer. Jämför omdömen och be om hjälp på en minut.</p>
          <div className="mt-8 flex max-w-xl gap-2 rounded-xl bg-white p-2">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Sök tjänst eller ort, t.ex. Göteborg"
              className="h-14 border-0 bg-white text-lg text-foreground shadow-none focus-visible:ring-0" />
            <Button size="lg" className="h-14 px-6 text-lg" onClick={() => document.getElementById("tjanster")?.scrollIntoView({ behavior: "smooth" })}>Sök</Button>
          </div>
          <p className="mt-6 text-base opacity-90">Ring oss: <a href="tel:020000000" className="font-semibold underline">020-000 000</a></p>
        </div>
      </section>

      <section id="tjanster" className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="text-3xl font-bold">Vad behöver du hjälp med?</h2>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {CATEGORIES.map((c) => (
            <button key={c.name} onClick={() => setCat(cat === c.name ? "" : c.name)}
              className={`rounded-2xl border-2 bg-white p-4 text-center transition hover:-translate-y-0.5 hover:shadow-md ${cat === c.name ? "border-primary bg-primary/5" : "border-transparent"}`}>
              <div className="text-4xl">{c.icon}</div>
              <div className="mt-2 text-base font-semibold">{c.name}</div>
            </button>
          ))}
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {shown.map((p) => (
            <article key={p._row_id} className="relative flex flex-col rounded-2xl border bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <ListingPhotos name={p.name} avatar={p.avatar_path} cover={p.cover_path} />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">{p.category}</span>
                  <h3 className="mt-3 text-2xl font-bold">
                    {/* The link covers the whole card (after:inset-0); the button sits above it. */}
                    <Link to={providerPath(p)} className="after:absolute after:inset-0 after:rounded-2xl after:content-[''] hover:underline">{p.name}</Link>
                  </h3>
                  <p className="text-base text-muted-foreground">📍 {p.city}</p>
                </div>
                <div className="text-right">
                  {p.reviews ? (
                    <>
                      <div className="text-xl font-bold text-amber-600">★ {(p.rating ?? 0).toFixed(1)}</div>
                      <div className="text-sm text-muted-foreground">{p.reviews} omdömen</div>
                    </>
                  ) : (
                    <div className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800">Ny utförare</div>
                  )}
                </div>
              </div>
              <p className="mt-3 flex-1 text-base">{p.description}</p>
              <div className="mt-4 flex items-center justify-between">
                <div>
                  <div className="text-xl font-bold">från {p.price_from} kr{priceUnit(p.category)}</div>
                  {p.rut ? <div className="text-sm font-medium text-success">RUT-avdrag möjligt</div> : null}
                </div>
                <div className="relative z-10 flex items-center gap-3">
                  <span className="hidden text-base font-semibold text-primary sm:inline" aria-hidden="true">Läs mer →</span>
                  <Button size="lg" className="text-base" onClick={() => request.ask(p)}>Be om hjälp</Button>
                </div>
              </div>
            </article>
          ))}
          {shown.length === 0 && <p className="text-muted-foreground">Inga tjänster hittades. Prova en annan sökning.</p>}
        </div>
      </section>

      <section id="sa-fungerar-det" className="bg-white py-12">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 md:grid-cols-3">
          {[["1", "Skapa konto", "Registrera dig gratis med e-post och lösenord."],
            ["2", "Skicka förfrågan", "Välj en granskad utförare och berätta kort vad du behöver."],
            ["3", "Vi hör av oss", "Utföraren ringer upp dig och ni kommer överens om tid."]].map(([n, t, d]) => (
            <div key={n}>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">{n}</div>
              <h3 className="mt-3 text-2xl font-bold">{t}</h3>
              <p className="mt-1 text-base text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
        <div className="mx-auto mt-10 max-w-6xl px-4">
          <div className="rounded-2xl bg-primary/5 p-6">
            <h3 className="text-2xl font-bold">Vill du erbjuda dina tjänster?</h3>
            <p className="mt-1 text-base text-muted-foreground">Registrera dig som utförare med foto och momsregistreringsnummer. Vi granskar alla ansökningar innan de publiceras.</p>
            <Button asChild size="lg" className="mt-4 text-base"><Link to="/bli-utforare">Bli utförare</Link></Button>
          </div>
        </div>
      </section>

      {request.dialog}
    </div>
  );
}
