import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import ProviderProfile from "@/components/provider/ProviderProfile";
import {
  draftFromUser,
  profileChanges,
  readUserMetadata,
  validateProfileDraft,
  type ProfileDraft,
} from "@/lib/authAccount";

const EMPTY_DRAFT: ProfileDraft = { firstName: "", lastName: "", email: "" };

export default function ProfilePage() {
  const { user, loading, updateUser, refresh, reauthenticateWithPasskey, cancelEmailChange, resendEmailChange } = useAuth();
  const initialized = useRef(false);
  const [draft, setDraft] = useState<ProfileDraft>(EMPTY_DRAFT);
  const [emailEdited, setEmailEdited] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [needsStepUp, setNeedsStepUp] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user && !initialized.current) {
      setDraft(draftFromUser(user));
      setEmailEdited(false);
      initialized.current = true;
    }
  }, [loading, user]);

  function updateDraft(field: keyof ProfileDraft, value: string): void {
    if (field === "email") setEmailEdited(true);
    setDraft((current: ProfileDraft) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setStatus(null);

    const validationError = validateProfileDraft(draft);
    if (validationError) {
      setError(validationError);
      return;
    }

    const changes = profileChanges(user, draft);
    const cancelPending = Boolean(user?.pendingEmail) && emailEdited && !emailChanged;
    if (!changes && !cancelPending) {
      setStatus("Det finns inga ändringar att spara.");
      return;
    }

    const proof = !cancelPending && changes?.email && currentPassword ? { currentPassword } : {};
    await saveChanges(cancelPending ? { ...changes, email: user.email } : changes ?? {}, proof, cancelPending);
  }

  async function saveChanges(
    changes: { firstName?: string; lastName?: string; email?: string },
    proof: { currentPassword?: string },
    cancelPending = false,
  ): Promise<void> {
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      if (Object.keys(changes).length > 0) await updateUser({ ...changes, ...proof });
      if (cancelPending && Object.keys(changes).length === 0) await cancelEmailChange();
      if (cancelPending || changes.email) {
        setDraft((current) => ({ ...current, email: user.email }));
      }
      await refresh();
      setEmailEdited(false);
      setCurrentPassword("");
      setNeedsStepUp(false);
      const hasNameChanges = changes.firstName !== undefined || changes.lastName !== undefined;
      setStatus(cancelPending ? `Bytet av e-postadress är avbrutet.${hasNameChanges ? " Profilen är sparad." : ""}`
        : emailChanged ? "Profilen är sparad. Titta i din nya inkorg för att bekräfta den nya e-postadressen." : "Profilen är sparad.");
    } catch (caught: unknown) {
      const message = caught instanceof Error ? caught.message : "okänt fel";
      if ((caught as { code?: string } | null)?.code === "impersonation_refused") {
        setError("Ändringar i profilen kan inte sparas när du agerar som en annan användare.");
      } else if (message.includes("reauth_required")) {
        setNeedsStepUp(true);
        setError("Skriv ditt nuvarande lösenord, eller bekräfta med en nyckel (passkey), för att byta e-postadress.");
      } else if (message.includes("bad_credentials")) {
        setError("Det nuvarande lösenordet stämmer inte.");
      } else {
        setError(`Det gick inte att spara profilen: ${message}`);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleResend(): Promise<void> {
    setSaving(true);
    setError(null);
    setStatus(null);
    const pendingEmail = user.pendingEmail;
    try {
      await resendEmailChange();
      toast.success(`Om bytet fortfarande väntar har vi skickat en ny länk till ${pendingEmail}. Det kan ta några minuter innan den kommer fram.`);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Det gick inte att skicka bekräftelselänken igen.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePasskeyStepUp(): Promise<void> {
    const changes = profileChanges(user, draft);
    if (!changes) return;
    setError(null);
    try {
      await reauthenticateWithPasskey();
    } catch {
      setError("Bekräftelsen med nyckel avbröts eller misslyckades. Försök igen, eller logga ut och logga in igen.");
      return;
    }
    await saveChanges(changes, {});
  }

  const emailChanged = user !== null
    && draft.email.trim().toLowerCase() !== draftFromUser(user).email.trim().toLowerCase();

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 aria-label="Laddar profilen" className="animate-spin w-8 h-8 text-primary" />
      </div>
    );
  }

  const metadata = readUserMetadata(user);
  const metadataEntries = Object.entries(metadata);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <div className="max-w-3xl space-y-6">
        <Link to="/account" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft size={16} /> Tillbaka till kontot
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Profil</h1>

        <section className="rounded-lg border border-border bg-card p-6 shadow-xs">
          <h2 className="text-base font-semibold text-foreground">Kontouppgifter</h2>
          <p className="mt-1 text-sm text-muted-foreground">Ändra namnet och e-postadressen som hör till ditt konto.</p>
          <div className="mt-6">
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="profile-first-name">Förnamn</Label>
                <Input
                  id="profile-first-name"
                  autoComplete="given-name"
                  value={draft.firstName}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    updateDraft("firstName", event.target.value)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile-last-name">Efternamn</Label>
                <Input
                  id="profile-last-name"
                  autoComplete="family-name"
                  value={draft.lastName}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    updateDraft("lastName", event.target.value)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile-email">E-post</Label>
                <Input
                  id="profile-email"
                  type="email"
                  autoComplete="email"
                  value={draft.email}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    updateDraft("email", event.target.value)
                  }
                />
                {user?.pendingEmail && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Väntar på bekräftelse från {user.pendingEmail}. Öppna länken vi skickade dit för att slutföra bytet.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" disabled={saving} onClick={handleResend}>
                        Skicka länken igen
                      </Button>
                      <Button type="button" variant="outline" disabled={saving} onClick={() => saveChanges({}, {}, true)}>
                        Avbryt bytet
                      </Button>
                    </div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Om du byter e-postadress loggar du in med den nya adressen. Vi skickar en
                  bekräftelselänk till den nya adressen, och bytet gäller när du har öppnat länken.
                </p>
              </div>

              {emailChanged && (
                <div className="space-y-2">
                  <Label htmlFor="profile-current-password">Nuvarande lösenord</Label>
                  <Input
                    id="profile-current-password"
                    type="password"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      setCurrentPassword(event.target.value)
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Behövs för att byta e-postadress. Lämna tomt om du loggade in för bara några minuter sedan.
                  </p>
                </div>
              )}

              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}
              {status && <p className="text-sm text-primary">{status}</p>}

              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 size={16} className="animate-spin mr-2" />}
                  Spara ändringar
                </Button>
                {needsStepUp && (
                  <Button type="button" variant="outline" disabled={saving} onClick={handlePasskeyStepUp}>
                    Bekräfta med nyckel
                  </Button>
                )}
              </div>
            </form>
          </div>
        </section>

        <ProviderProfile />

        <section className="rounded-lg border border-border bg-card p-6 shadow-xs">
          <h2 className="text-base font-semibold text-foreground">Profiluppgifter</h2>
          <p className="mt-1 text-sm text-muted-foreground">Övriga uppgifter som webbplatsen har sparat.</p>
          <div className="mt-6">
            {metadataEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">Inga profiluppgifter sparade än.</p>
            ) : (
              <dl className="divide-y rounded-lg border bg-card">
                {metadataEntries.map(([key, value]: [string, string]) => (
                  <div key={key} className="grid gap-1 px-4 py-3 sm:grid-cols-3 sm:gap-4">
                    <dt className="text-sm font-medium">{key}</dt>
                    <dd className="text-sm text-muted-foreground sm:col-span-2">{value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
