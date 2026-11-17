import { FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import auth from "@/lib/shared/kliv-auth.js";
import AuthCard from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function PasswordResetComplete() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!token) {
    return (
      <AuthCard
        description="Länken är ofullständig. Be om ett nytt mejl."
        title="Länken fungerar inte"
      >
        <Button asChild className="w-full">
          <Link to="/auth/reset">Be om en ny länk</Link>
        </Button>
      </AuthCard>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Lösenorden är inte likadana.");
      return;
    }
    setSubmitting(true);
    try {
      await auth.completePasswordReset(token, password);
      // completePasswordReset does NOT auto-sign-in — bounce to login.
      navigate("/login", {
        replace: true,
        state: { from: "/", message: "Lösenordet är ändrat. Logga in med ditt nya lösenord." },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("invalid_token")) {
        setError("Länken har gått ut eller har redan använts. Be om en ny.");
      } else if (msg.includes("insufficient_password_complexity")) {
        setError("Lösenordet är för svagt. Välj ett längre lösenord som inte är din e-postadress eller ett vanligt lösenord.");
      } else {
        setError("Det gick inte att ändra lösenordet. Försök igen.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard description="Välj något du kommer ihåg men som inte är lätt att gissa." title="Välj ett nytt lösenord">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">Nytt lösenord</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Upprepa det nya lösenordet</Label>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        {error && (
          <p className="text-sm text-destructive" role="alert">{error}</p>
        )}
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Sparar…" : "Spara nytt lösenord"}
        </Button>
      </form>
    </AuthCard>
  );
}
