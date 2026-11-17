import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { db } from "@/lib/shared/kliv-database.js";
import { contentImage } from "@/lib/shared/kliv-content.js";
import { Button } from "@/components/ui/button";
import { CATEGORIES } from "@/lib/roles";
import { useRequestDialog } from "@/components/provider/RequestDialog";
import { formatKr, parsePriceList, priceUnit, providerPath, type Provider } from "@/lib/providers";

const STEPS: [string, string][] = [
  ["Skicka en förfrågan", "Tryck på ”Be om hjälp” och berätta kort vad du behöver. Du behöver ett konto (gratis)."],
  ["Utföraren ringer upp", "Utföraren hör av sig per telefon. Ni kommer överens om tid och pris."],
  ["Arbetet utförs", "Utföraren kommer hem till dig på den tid ni bestämt."],
  ["Betalning", "Du betalar utföraren direkt enligt det ni kommit överens om. Har utföraren RUT-avdrag dras det av på fakturan."],
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t pt-8">
      <h2 className="text-2xl font-bold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Rating({ p, large }: { p: Provider; large?: boolean }) {
  if (!p.reviews) {
    return <span className="inline-block rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800">Ny utförare</span>;
  }
  return (
    <div className="flex items-baseline gap-2">
      <span className={`font-bold text-amber-600 ${large ? "text-3xl" : "text-xl"}`}>★ {(p.rating ?? 0).toFixed(1)}</span>
      <span className="text-base text-muted-foreground">{p.reviews} omdömen</span>
    </div>
  );
}

export default function ProviderDetail() {
  const { id } = useParams();
  const [p, setP] = useState<Provider | null | undefined>(undefined);
  const [others, setOthers] = useState<Provider[]>([]);
  const request = useRequestDialog(`/utforare/${id}`);

  useEffect(() => {
    window.scrollTo(0, 0);
    setP(undefined);
    setOthers([]);
    db.query<Provider>("providers", { _row_id: `eq.${id}`, limit: 1 })
      .then(async (rows) => {
        const found = rows[0] ?? null;
        setP(found);
        if (found) document.title = `${found.name} – ${found.category} i ${found.city} – Seniorportalen`;
        if (found?.user_uuid) {
          const same = await db.query<Provider>("providers", { user_uuid: `eq.${found.user_uuid}`, order: "name.asc" });
          setOthers(same.filter((o) => o._row_id !== found._row_id));
        }
      })
      .catch(() => setP(null));
  }, [id]);

  if (p === undefined) return <p className="mx-auto max-w-6xl px-4 py-16 text-lg text-muted-foreground">Laddar…</p>;
  if (p === null) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center text-lg">
        <h1 className="text-3xl font-bold">Utföraren hittades inte</h1>
        <p className="mt-2 text-muted-foreground">Annonsen kan ha tagits bort.</p>
        <Button asChild size="lg" className="mt-6 text-base"><Link to="/">Till startsidan</Link></Button>
      </div>
    );
  }

  const prices = parsePriceList(p.price_list);
  const icon = CATEGORIES.find((c) => c.name === p.category)?.icon;
  const verified = !!p.user_uuid;

  const bookingBox = (
    <div className="space-y-4 rounded-2xl border bg-white p-6 shadow-sm">
      <div>
        <div className="text-sm text-muted-foreground">Pris från</div>
        <div className="text-3xl font-bold">{p.price_from != null ? `${formatKr(p.price_from)}${priceUnit(p.category)}` : "Enligt överenskommelse"}</div>
        {p.rut ? <div className="mt-1 text-base font-medium text-success">RUT-avdrag möjligt – du betalar hälften av arbetskostnaden</div> : null}
      </div>
      <Rating p={p} large />
      <Button size="lg" className="h-14 w-full text-lg" onClick={() => request.ask(p)}>Be om hjälp</Button>
      <p className="text-sm text-muted-foreground">Det kostar inget att skicka en förfrågan. Utföraren ringer upp dig.</p>
    </div>
  );

  return (
    <div className="pb-28 text-lg md:pb-12">
      <div className="mx-auto max-w-6xl px-4 pt-6">
        <nav aria-label="Brödsmulor" className="text-base text-muted-foreground">
          <Link to="/" className="hover:underline">Startsida</Link>
          <span className="mx-2">›</span>
          <Link to="/#tjanster" className="hover:underline">{p.category}</Link>
          <span className="mx-2">›</span>
          <span className="text-foreground">{p.name}</span>
        </nav>
      </div>

      <div className="mx-auto mt-4 grid max-w-6xl gap-8 px-4 md:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-8">
          <header>
            <div className="relative">
              {p.cover_path ? (
                <img {...contentImage(p.cover_path, { widths: [640, 960, 1280, 1920], sizes: "(min-width: 768px) 720px, 100vw" })}
                  alt={`Bild från ${p.name}`} fetchPriority="high" decoding="async"
                  className="aspect-[16/9] w-full rounded-2xl object-cover" />
              ) : (
                <div className="flex aspect-[16/6] w-full items-center justify-center rounded-2xl bg-primary/10 text-7xl" aria-hidden="true">{icon}</div>
              )}
              {p.avatar_path && (
                <img {...contentImage(p.avatar_path, { widths: [160, 320], sizes: "128px" })}
                  alt={`Foto på ${p.name}`} decoding="async"
                  className="absolute -bottom-12 left-6 h-28 w-28 rounded-full border-4 border-white bg-white object-cover shadow-md md:h-32 md:w-32" />
              )}
            </div>
            <div className={p.avatar_path ? "mt-16" : "mt-6"}>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">{icon} {p.category}</span>
              <h1 className="mt-3 text-4xl font-bold leading-tight">{p.name}</h1>
              <p className="mt-1 text-lg text-muted-foreground">📍 {p.city}</p>
              {p.description && <p className="mt-3 text-xl">{p.description}</p>}
              <ul className="mt-4 flex flex-wrap gap-2 text-base">
                {verified && <li className="rounded-full border border-success/40 bg-success/10 px-3 py-1 font-medium">✓ Granskad av Seniorportalen</li>}
                {verified && <li className="rounded-full border border-success/40 bg-success/10 px-3 py-1 font-medium">✓ Momsregistrerat företag</li>}
                {p.rut ? <li className="rounded-full border border-success/40 bg-success/10 px-3 py-1 font-medium">✓ RUT-avdrag</li> : null}
                <li className="rounded-full border px-3 py-1 font-medium">✓ Gratis att skicka förfrågan</li>
              </ul>
            </div>
          </header>

          <div className="md:hidden">{bookingBox}</div>

          {p.about && (
            <Section title="Om oss">
              <div className="flex gap-4">
                {p.avatar_path && (
                  <img src={`${p.avatar_path}?w=160`} alt="" aria-hidden="true" className="h-16 w-16 shrink-0 rounded-full object-cover" />
                )}
                <p className="whitespace-pre-wrap">{p.about}</p>
              </div>
            </Section>
          )}

          <Section title="Priser">
            {prices.length > 0 ? (
              <table className="w-full text-left text-lg">
                <tbody className="divide-y">
                  {prices.map((r, i) => (
                    <tr key={i}>
                      <th scope="row" className="py-3 pr-4 font-normal">{r.name}</th>
                      <td className="py-3 text-right font-bold whitespace-nowrap">{formatKr(r.price)}{r.unit ? ` ${r.unit}` : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>{p.price_from != null ? `Från ${formatKr(p.price_from)}${priceUnit(p.category)}. ` : ""}Exakt pris får du när utföraren ringer upp.</p>
            )}
            <p className="mt-3 text-base text-muted-foreground">
              Priserna är inklusive moms{p.rut ? " och före RUT-avdrag" : ""}.
            </p>
          </Section>

          <Section title="Så går det till">
            <ol className="grid gap-5 sm:grid-cols-2">
              {STEPS.map(([t, d], i) => (
                <li key={t} className="flex gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">{i + 1}</span>
                  <div>
                    <div className="font-bold">{t}</div>
                    <p className="text-base text-muted-foreground">{d}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Section>

          {p.good_to_know && (
            <Section title="Bra att veta">
              <p className="whitespace-pre-wrap">{p.good_to_know}</p>
            </Section>
          )}

          {p.cancellation && (
            <Section title="Avbokning">
              <p className="whitespace-pre-wrap">{p.cancellation}</p>
            </Section>
          )}

          <Section title="Område">
            <p>{p.service_area || p.city}</p>
          </Section>

          {others.length > 0 && (
            <Section title="Fler tjänster från samma utförare">
              <ul className="grid gap-4 sm:grid-cols-2">
                {others.map((o) => (
                  <li key={o._row_id}>
                    <Link to={providerPath(o)} className="block rounded-2xl border bg-white p-5 transition hover:shadow-md">
                      <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">{o.category}</span>
                      <div className="mt-2 text-xl font-bold">{o.name}</div>
                      <div className="text-base text-muted-foreground">📍 {o.city}{o.price_from != null ? ` · från ${formatKr(o.price_from)}${priceUnit(o.category)}` : ""}</div>
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>

        <aside className="hidden md:block">
          <div className="sticky top-6">{bookingBox}</div>
        </aside>
      </div>

      {/* Always-reachable request button on phones. */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-white p-3 shadow-[0_-4px_12px_rgb(0_0_0/0.06)] md:hidden">
        <Button size="lg" className="h-14 w-full text-lg" onClick={() => request.ask(p)}>Be om hjälp</Button>
      </div>

      {request.dialog}
    </div>
  );
}
