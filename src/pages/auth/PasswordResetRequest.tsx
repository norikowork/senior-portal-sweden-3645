import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import auth from "@/lib/shared/kliv-auth.js";
import AuthCard from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function PasswordResetRequest() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await auth.requestPasswordReset(email);
      // Backend returns 200 for any email (enumeration protection). Always
      // show the same generic confirmation so the UI doesn't leak whether
      // the address is registered.
      setSent(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("email_rate_limit_exceeded")) {
        setError("Du har bett om för många länkar. Vänta några minuter och försök igen.");
      } else if (msg.includes("email_template_not_configured")) {
        setError("Mejl för att återställa lösenord är inte inställt än. Kontakta oss.");
      } else {
        setError("Det gick inte att skicka mejlet. Försök igen om en stund.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard
      description="Skriv din e-postadress så skickar vi en länk där du kan välja ett nytt lösenord."
      title="Återställ ditt lösenord"
    >
      {sent ? (
        <div className="space-y-4">
          <p className="text-sm">
            Om det finns ett konto för <span className="font-medium">{email}</span> har vi
            skickat en länk för att återställa lösenordet. Titta i din inkorg (och i skräpposten).
          </p>
          <p className="text-sm text-muted-foreground">
            Om adressen tillhör ägaren av den här webbplatsen hanteras lösenordet i ditt Kliv-konto –
            mejlet förklarar var du återställer det.
          </p>
          <Button asChild variant="outline" className="w-full">
            <Link to="/login">Tillbaka till inloggningen</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-post</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">{error}</p>
          )}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Skickar…" : "Skicka länk"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Kom du ihåg det?{" "}
            <Link to="/login" className="text-foreground underline-offset-4 hover:underline">
              Logga in
            </Link>
          </p>
        </form>
      )}
    </AuthCard>
  );
}
