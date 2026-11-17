import { waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { onSignInElsewhere, rememberSignInTarget, takeSignInTarget, verificationFailure } from "./signInVerification";

const refusal = (code: string) => Object.assign(new Error(code), { code });

describe("verificationFailure", () => {
  it("tells a link opened elsewhere to go back to the browser that signed in", () => {
    const failure = verificationFailure(refusal("verification_other_browser"), "link");
    expect(failure.title).toBe("Öppna länken i webbläsaren där du loggade in");
    expect(failure.restart).toBe(false);
  });

  it("ends a code sign-in whose browser binding is gone", () => {
    expect(verificationFailure(refusal("verification_other_browser"), "code").restart).toBe(true);
  });

  it("lets a wrong code be retried, but not a dead link", () => {
    expect(verificationFailure(refusal("verification_invalid"), "code")).toMatchObject({ title: "Fel kod", restart: false });
    expect(verificationFailure(refusal("verification_invalid"), "link")).toMatchObject({ title: "Länken går inte att använda", restart: true });
  });

  it("sends the member back to sign in once the guesses are spent", () => {
    expect(verificationFailure(refusal("too_many_attempts"), "code")).toMatchObject({
      description: "Logga in igen för att få en ny kod.",
      restart: true,
    });
  });

  it("explains that verification is unavailable", () => {
    expect(verificationFailure(refusal("verification_unavailable"), "link").title).toBe("Inloggningen kan inte verifieras");
  });

  it("falls back to a generic restart for anything else, including a non-error", () => {
    for (const reason of [refusal("internal_error"), new Error("network"), null, "text"]) {
      expect(verificationFailure(reason, "code")).toMatchObject({ title: "Något gick fel", restart: true });
    }
  });
});

describe("the remembered sign-in target", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns the target once, then the home page", () => {
    rememberSignInTarget("/account/profile?highlight=email");
    expect(takeSignInTarget()).toBe("/account/profile?highlight=email");
    expect(takeSignInTarget()).toBe("/");
  });

  it("is the home page when nothing was remembered", () => {
    expect(takeSignInTarget()).toBe("/");
  });

  it("never remembers or returns an off-site target", () => {
    rememberSignInTarget("//evil.example/steal");
    expect(takeSignInTarget()).toBe("/");
    rememberSignInTarget("https://evil.example/steal");
    expect(takeSignInTarget()).toBe("/");
    localStorage.setItem("auth_basic.signInTarget", "//evil.example/steal");
    expect(takeSignInTarget()).toBe("/");
  });
});

describe("onSignInElsewhere", () => {
  let stop: () => void = () => {};

  afterEach(() => {
    stop();
  });

  const storageChange = (key: string | null, newValue: string | null) =>
    window.dispatchEvent(new StorageEvent("storage", { key, newValue }));

  it("looks when another tab takes the remembered target", () => {
    const check = vi.fn().mockResolvedValue(null);
    stop = onSignInElsewhere(check);
    storageChange("auth_basic.signInTarget", null);
    expect(check).toHaveBeenCalledOnce();
  });

  it("ignores other storage changes, and the target being remembered", () => {
    const check = vi.fn().mockResolvedValue(null);
    stop = onSignInElsewhere(check);
    storageChange("something.else", null);
    storageChange("auth_basic.signInTarget", "/account");
    storageChange(null, null);
    expect(check).not.toHaveBeenCalled();
  });

  it("looks when the member comes back to the tab", () => {
    const check = vi.fn().mockResolvedValue(null);
    stop = onSignInElsewhere(check);
    window.dispatchEvent(new Event("focus"));
    expect(check).toHaveBeenCalledOnce();
  });

  it("runs one look at a time, and looks again after a failed one", async () => {
    let fail: (reason: unknown) => void = () => {};
    const check = vi.fn().mockImplementationOnce(() => new Promise((_, reject) => { fail = reject; }))
      .mockResolvedValue(null);
    stop = onSignInElsewhere(check);
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
    expect(check).toHaveBeenCalledOnce();

    fail(new Error("offline"));
    await waitFor(() => {
      window.dispatchEvent(new Event("focus"));
      expect(check).toHaveBeenCalledTimes(2);
    });
  });

  it("stops listening when stopped", () => {
    const check = vi.fn().mockResolvedValue(null);
    onSignInElsewhere(check)();
    window.dispatchEvent(new Event("focus"));
    storageChange("auth_basic.signInTarget", null);
    expect(check).not.toHaveBeenCalled();
  });
});
