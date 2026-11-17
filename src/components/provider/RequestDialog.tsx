import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { db } from "@/lib/shared/kliv-database.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import type { Provider } from "@/lib/providers";

type Target = Pick<Provider, "_row_id" | "name" | "category" | "city" | "user_uuid">;

function displayName(user: { firstName?: string; lastName?: string } | null): string {
  return [user?.firstName, user?.lastName].filter(Boolean).join(" ");
}

/**
 * `ask(p)` opens the form, or sends a signed-out visitor to sign in first (and back to `returnTo`).
 * Render `dialog` once in the page.
 */
export function useRequestDialog(returnTo: string) {
  const { user, signedIn } = useAuth();
  const navigate = useNavigate();
  const [sel, setSel] = useState<Target | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", message: "" });
  const [busy, setBusy] = useState(false);

  function ask(p: Target) {
    if (!signedIn) {
      toast("Logga in eller skapa ett konto för att be om hjälp.");
      navigate(`/login?redirect=${encodeURIComponent(returnTo)}`);
      return;
    }
    setForm((f) => ({ ...f, name: f.name || displayName(user) }));
    setSel(p);
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!sel) return;
    setBusy(true);
    try {
      await db.insertOne("requests", {
        provider_id: String(sel._row_id), provider_user: sel.user_uuid ?? null,
        service: `${sel.category} – ${sel.name}`,
        name: form.name, phone: form.phone, city: sel.city, message: form.message,
      });
      toast.success("Tack! Din förfrågan är skickad. Du hittar den under Mina sidor.");
      setSel(null); setForm({ name: "", phone: "", message: "" });
    } catch {
      toast.error("Något gick fel, försök igen.");
    } finally { setBusy(false); }
  }

  const dialog = (
    <Dialog open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-2xl">Be om hjälp</DialogTitle>
          <DialogDescription className="text-base">{sel?.name} – {sel?.category}, {sel?.city}</DialogDescription>
        </DialogHeader>
        <form onSubmit={send} className="space-y-3">
          <Input required placeholder="Ditt namn" className="h-12 text-base" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input required type="tel" placeholder="Telefonnummer" className="h-12 text-base" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Textarea placeholder="Vad behöver du hjälp med?" className="text-base" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
          <Button type="submit" size="lg" className="w-full text-lg" disabled={busy}>{busy ? "Skickar…" : "Skicka förfrågan"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );

  return { ask, dialog };
}
