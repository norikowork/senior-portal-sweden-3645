import { useState } from "react";
import { toast } from "sonner";
import functions from "@/lib/shared/kliv-functions.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ImageReview } from "@/components/provider/ListingImages";
import { formatDate } from "@/pages/MyPages";

export type ReviewWithNames = ImageReview & { listingName?: string; providerName?: string };

function ReviewCard({ r, onDone }: { r: ReviewWithNames; onDone: () => void }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function decide(decision: "approve" | "reject") {
    setBusy(true);
    try {
      await functions.post("image-review", { action: "decide", id: r._row_id, decision, note });
      toast.success(decision === "approve" ? "Bilden är godkänd och publicerad." : "Bilden är avslagen och borttagen.");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Något gick fel.");
    } finally { setBusy(false); }
  }

  return (
    <li className="flex flex-col gap-4 rounded-2xl border bg-white p-5 sm:flex-row">
      <a href={r.path} target="_blank" rel="noreferrer" className="shrink-0">
        <img src={`${r.path}?w=640`} alt={`Uppladdad bild från ${r.providerName ?? "utförare"}`}
          className={r.kind === "avatar" ? "h-40 w-40 rounded-full border object-cover" : "h-40 w-64 rounded-xl border object-cover"} />
      </a>
      <div className="flex-1 space-y-2 text-base">
        <div className="font-bold">
          {r.kind === "avatar" ? "Ny profilbild" : `Ny bild för annonsen ”${r.listingName ?? "okänd annons"}”`}
        </div>
        <div className="text-muted-foreground">{r.providerName ?? "Okänd utförare"} · {formatDate(r._created_at)}</div>
        <Input placeholder="Kommentar till utföraren (valfritt, visas vid avslag)" value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy} onClick={() => decide("approve")}>Godkänn och publicera</Button>
          <Button disabled={busy} variant="destructive" onClick={() => decide("reject")}>Avslå och ta bort</Button>
        </div>
      </div>
    </li>
  );
}

export default function ImageReviews({ reviews, onDone }: { reviews: ReviewWithNames[]; onDone: () => void }) {
  const pending = reviews.filter((r) => r.status === "pending");
  return (
    <div className="mt-4 space-y-3">
      <p className="text-sm text-muted-foreground">
        Bilder som godkända utförare laddat upp. De syns inte på sajten förrän du godkänner dem. Avslagna bilder raderas.
      </p>
      {pending.length === 0 ? <p className="text-muted-foreground">Inga bilder att granska.</p> : (
        <ul className="space-y-4">{pending.map((r) => <ReviewCard key={r._row_id} r={r} onDone={onDone} />)}</ul>
      )}
    </div>
  );
}
