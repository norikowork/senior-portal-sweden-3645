import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "@/lib/shared/kliv-database.js";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { isAdmin } from "@/lib/roles";
import { STATUS_LABEL, type Application } from "./BecomeProvider";

export type ServiceRequest = {
  _row_id: number; _created_at: number; service: string; name: string; phone: string;
  city: string | null; message: string | null;
};

export function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleString("sv-SE", { dateStyle: "medium", timeStyle: "short" });
}

function RequestCard({ r, showContact }: { r: ServiceRequest; showContact: boolean }) {
  return (
    <li className="rounded-xl border bg-white p-4 text-base">
      <div className="flex flex-wrap justify-between gap-2">
        <span className="font-semibold">{r.service}</span>
        <span className="text-sm text-muted-foreground">{formatDate(r._created_at)}</span>
      </div>
      {showContact && <div className="mt-1">{r.name} · <a className="font-semibold text-primary underline" href={`tel:${r.phone}`}>{r.phone}</a>{r.city ? ` · ${r.city}` : ""}</div>}
      {r.message && <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{r.message}</p>}
    </li>
  );
}

export default function MyPages() {
  const { user } = useAuth();
  const [mine, setMine] = useState<ServiceRequest[]>([]);
  const [incoming, setIncoming] = useState<ServiceRequest[]>([]);
  const [app, setApp] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Mina sidor – Seniorportalen";
    const uuid = user?.userUuid;
    if (!uuid) return;
    Promise.all([
      db.query<ServiceRequest>("requests", { _created_by: `eq.${uuid}`, order: "_created_at.desc" }),
      db.query<ServiceRequest>("requests", { provider_user: `eq.${uuid}`, order: "_created_at.desc" }),
      db.query<Application>("provider_applications", { user_uuid: `eq.${uuid}`, order: "_created_at.desc", limit: 1 }),
    ]).then(([m, i, a]) => { setMine(m); setIncoming(i); setApp(a[0] ?? null); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.userUuid]);

  const name = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 text-lg">
      <h1 className="text-3xl font-bold">Mina sidor</h1>
      <p className="mt-1 text-base text-muted-foreground">Inloggad som {name}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button asChild variant="outline" className="text-base"><Link to="/account">Kontoinställningar</Link></Button>
        {isAdmin(user) && <Button asChild variant="outline" className="text-base"><Link to="/admin">Admin</Link></Button>}
      </div>

      {loading ? <p className="mt-8 text-base text-muted-foreground">Laddar…</p> : (
        <>
          {app && (
            <section className="mt-10">
              <h2 className="text-2xl font-bold">Som utförare</h2>
              <div className="mt-3 rounded-xl border bg-white p-4 text-base">
                <span className="font-semibold">{app.company_name}</span> – {STATUS_LABEL[app.status] ?? app.status}
                {app.status === "rejected" && <Link to="/bli-utforare" className="ml-2 text-primary underline">Skicka ny ansökan</Link>}
                {app.status !== "rejected" && <Link to="/account/profile" className="ml-2 font-semibold text-primary underline">Redigera profil och bilder</Link>}
              </div>
              {app.status === "approved" && (
                <>
                  <h3 className="mt-6 text-xl font-bold">Förfrågningar till dig</h3>
                  {incoming.length === 0 ? <p className="mt-2 text-base text-muted-foreground">Inga förfrågningar än.</p> : (
                    <ul className="mt-3 space-y-3">{incoming.map((r) => <RequestCard key={r._row_id} r={r} showContact />)}</ul>
                  )}
                </>
              )}
            </section>
          )}

          <section className="mt-10">
            <h2 className="text-2xl font-bold">Mina förfrågningar</h2>
            {mine.length === 0 ? (
              <p className="mt-2 text-base text-muted-foreground">Du har inte skickat några förfrågningar än. <Link to="/" className="text-primary underline">Hitta hjälp</Link></p>
            ) : (
              <ul className="mt-3 space-y-3">{mine.map((r) => <RequestCard key={r._row_id} r={r} showContact={false} />)}</ul>
            )}
          </section>

          {!app && (
            <section className="mt-10 rounded-2xl bg-primary/5 p-6">
              <h2 className="text-xl font-bold">Vill du erbjuda tjänster?</h2>
              <Button asChild className="mt-3 text-base"><Link to="/bli-utforare">Bli utförare</Link></Button>
            </section>
          )}
        </>
      )}
    </div>
  );
}
