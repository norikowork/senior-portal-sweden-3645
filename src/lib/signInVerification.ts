// Sign-in verification on new devices: when the app verifies sign-ins, a browser it does not
// recognize gets `verification_required` from signIn, and the member is emailed a link to
// /verify-sign-in?token=... and a 6-digit code. Both only work in the browser that entered the
// password, so the page the member was headed for can be kept in that browser until they return.

const TARGET_KEY = "auth_basic.signInTarget";

export type VerificationFailure = {
  title: string;
  description: string;
  /** The verification is over: the member has to sign in again for a new email. */
  restart: boolean;
};

/** What to tell the member when verifySignIn refuses, by error code and by how they verified. */
export function verificationFailure(reason: unknown, via: "link" | "code"): VerificationFailure {
  const code = (reason as { code?: string } | null)?.code;
  switch (code) {
    case "verification_invalid":
      return via === "link"
        ? { title: "Länken går inte att använda", description: "Den har gått ut eller har redan använts. Logga in igen för att få en ny länk.", restart: true }
        : { title: "Fel kod", description: "Koden är fel eller har gått ut. Titta i mejlet och försök igen.", restart: false };
    case "verification_other_browser":
      return via === "link"
        ? {
            title: "Öppna länken i webbläsaren där du loggade in",
            description: "För din säkerhet fungerar en inloggningslänk bara i webbläsaren där du skrev ditt lösenord. Öppna den där, eller skriv in verifieringskoden med 6 siffror från mejlet på inloggningssidan där.",
            restart: false,
          }
        : { title: "Inloggningen har gått ut", description: "Inloggningen påbörjades i en annan webbläsare eller har gått ut. Logga in igen.", restart: true };
    case "too_many_attempts":
      return { title: "För många försök", description: "Logga in igen för att få en ny kod.", restart: true };
    case "verification_unavailable":
      return { title: "Inloggningen kan inte verifieras", description: "Vi kunde inte bekräfta din inloggning just nu. Försök igen senare eller kontakta oss.", restart: true };
    default:
      return { title: "Något gick fel", description: "Din inloggning kunde inte bekräftas. Logga in igen.", restart: true };
  }
}

/** Keeps a site-relative target for the verification link, which opens in a new tab. */
export function rememberSignInTarget(target: string) {
  try {
    if (target.startsWith("/") && !target.startsWith("//")) localStorage.setItem(TARGET_KEY, target);
  } catch {
    // Storage can be off (private windows, blocked site data); the link then lands on the home page.
  }
}

/** Returns and forgets the remembered target; "/" when there is none or it is not site-relative. */
export function takeSignInTarget(): string {
  let target: string | null = null;
  try {
    target = localStorage.getItem(TARGET_KEY);
    localStorage.removeItem(TARGET_KEY);
  } catch {
    // As above: no storage means no remembered target.
  }
  return target && target.startsWith("/") && !target.startsWith("//") ? target : "/";
}

/**
 * Calls `check` when this tab may have been signed in from another one: the emailed link opens in a
 * new tab, which signs the browser in and takes the remembered target (a `storage` event here), and
 * the member then comes back to this tab (it becomes visible or gains focus). At most one check runs
 * at a time. Returns the function that stops listening.
 */
export function onSignInElsewhere(check: () => Promise<unknown>): () => void {
  let checking = false;
  const run = () => {
    if (checking) return;
    checking = true;
    check()
      .catch(() => {
        // A failed look is the same as no sign-in yet: the next return to this tab looks again.
      })
      .finally(() => {
        checking = false;
      });
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === TARGET_KEY && event.newValue === null) run();
  };
  const onVisible = () => {
    if (document.visibilityState === "visible") run();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener("focus", run);
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("focus", run);
    document.removeEventListener("visibilitychange", onVisible);
  };
}
