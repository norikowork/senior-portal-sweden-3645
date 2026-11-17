import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import auth from "@/lib/shared/kliv-auth.js";
import AuthCard from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ActivationInfo {
  email: string;
  firstName: string | null;
  lastName: string | null;
  requiresPassword: boolean;
  isEmailChange: boolean;
}

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; info: ActivationInfo }
  | { kind: "invalid"; reason: string };

export default function Activate() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";

  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setState({ kind: "invalid", reason: "Aktiveringslänken är ofullständig." });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const info = (await auth.getActivationInfo(token)) as ActivationInfo;
        if (!cancelled) setState({ kind: "ready", info });
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        setState({
          kind: "invalid",
          reason: msg.includes("invalid_token")
            ? "Aktiveringslänken har gått ut eller har redan använts."
            : "Det gick inte att hämta uppgifterna för aktiveringen. Försök igen.",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await auth.activate(
        token,
        state.kind === "ready" && state.info.requiresPassword ? password : null,
      );
      // result is a user (new account → auto-signed-in) or
      // { message, status } (email change confirmation).
      if (result && typeof result === "object" && "userUuid" in result) {
        navigate("/", { replace: true });
      } else {
        navigate("/login", {
          replace: true,
          state: { message: "E-postadressen är bekräftad. Nu kan du logga in." },
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("invalid_token")) {
        setError("Aktiveringslänken har gått ut eller har redan använts.");
      } else if (msg.includes("password_required")) {
        setError("Du behöver välja ett lösenord för att aktivera kontot.");
      } else if (msg.includes("insufficient_password_complexity")) {
        setError("Lösenordet är för svagt. Välj ett längre lösenord som inte är din e-postadress eller ett vanligt lösenord.");
      } else if (msg.includes("email_exists")) {
        setError("E-postadressen används redan. Försök logga in i stället.");
      } else {
        setError("Aktiveringen misslyckades. Försök igen.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (state.kind === "loading") {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-16 text-sm text-muted-foreground sm:px-6" role="status">
        Kontrollerar din aktiveringslänk…
      </div>
    );
  }

  if (state.kind === "invalid") {
    return (
      <AuthCard description={state.reason} title="Aktiveringslänken fungerar inte">
        <Button asChild className="w-full">
          <Link to="/login">Tillbaka till inloggningen</Link>
        </Button>
      </AuthCard>
    );
  }

  const { info } = state;
  const heading = info.isEmailChange ? "Bekräfta din nya e-postadress" : "Aktivera ditt konto";
  const description = info.isEmailChange
    ? `Bekräfta ändringen till ${info.email}.`
    : `Välkommen${info.firstName ? `, ${info.firstName}` : ""}! Aktivera ditt konto för ${info.email}.`;

  return (
    <AuthCard description={description} title={heading}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {info.requiresPassword && (
          <div className="space-y-2">
            <Label htmlFor="password">Välj ett lösenord</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Välj ett långt lösenord som du inte använder någon annanstans.</p>
          </div>
        )}
        {error && (
          <p className="text-sm text-destructive" role="alert">{error}</p>
        )}
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Aktiverar…" : info.isEmailChange ? "Bekräfta e-postadressen" : "Aktivera kontot"}
        </Button>
      </form>
    </AuthCard>
  );
}
