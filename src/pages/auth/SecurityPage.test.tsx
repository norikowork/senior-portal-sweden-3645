import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Toaster } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import auth from "@/lib/shared/kliv-auth.js";
import { lastActiveLabel } from "@/lib/signedInDevices";

import SecurityPage from "./SecurityPage";

vi.mock("@/lib/shared/kliv-auth.js", () => ({
  default: { getUser: vi.fn(), listIdentities: vi.fn(), listSessions: vi.fn(), logoutAllDevices: vi.fn(), renameIdentity: vi.fn(), addPasskey: vi.fn(), reauthenticate: vi.fn(), enrollTotp: vi.fn() },
}));

// A fixture secret, not a real one. Every attribute that can make a browser load a URL is checked
// for it, because jsdom does not load images: a third-party QR <img> would never reach a fetch spy.
const FIXTURE_SECRET = "JBSWY3DPEHPK3PXP";
const FIXTURE_QR = "data:image/png;base64,iVBORw0KGgo=";
const URL_ATTRIBUTES = ["src", "srcset", "href", "data", "poster", "action", "formaction", "style"];

function totpEnrollment(qrCodeDataUri?: string) {
  return {
    secret: FIXTURE_SECRET,
    otpauthUri: `otpauth://totp/Kliv%3Aada%40example.test?secret=${FIXTURE_SECRET}&issuer=Kliv`,
    ...(qrCodeDataUri === undefined ? {} : { qrCodeDataUri }),
  };
}

function urlsCarryingTheSecret() {
  const carriers: string[] = [];
  for (const element of Array.from(document.querySelectorAll("*"))) {
    for (const name of URL_ATTRIBUTES) {
      const value = element.getAttribute(name);
      if (value !== null && value.includes(FIXTURE_SECRET)) carriers.push(`${element.tagName} ${name}`);
    }
  }
  return carriers;
}

const TWO_SESSIONS = [
  { device: "Chrome on Windows", deviceType: "desktop", country: "SE", lastActiveOn: 1761300000, current: true },
  { device: "Safari on iOS", deviceType: "phone", country: null, lastActiveOn: 1761200000, current: false },
];

function renderSecurity() {
  return render(<MemoryRouter><SecurityPage /><Toaster /></MemoryRouter>);
}

describe("SecurityPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth.reauthenticate).mockResolvedValue(undefined);
    vi.mocked(auth.getUser).mockResolvedValue({ userUuid: "user-1", email: "ada@example.test" });
    vi.mocked(auth.listIdentities).mockResolvedValue([
      { uuid: "identity-1", type: "webauthn", label: "Desk key" },
    ] as never);
    vi.mocked(auth.listSessions).mockResolvedValue(TWO_SESSIONS as never);
  });

  it("explains a missing passkey when renaming it", async () => {
    vi.mocked(auth.renameIdentity).mockRejectedValue(Object.assign(new Error("Missing (not_found)"), { code: "not_found" }));
    renderSecurity();
    fireEvent.click(await screen.findByRole("button", { name: "Byt namn" }));
    fireEvent.click(screen.getByRole("button", { name: "Spara" }));
    expect(await screen.findByText("Inloggningssättet finns inte längre eller är inte tillgängligt för dig.")).toBeInTheDocument();
  });

  it("explains an impersonated-session refusal", async () => {
    vi.mocked(auth.renameIdentity).mockRejectedValue(Object.assign(new Error("Refused (impersonation_refused)"), { code: "impersonation_refused" }));
    renderSecurity();
    fireEvent.click(await screen.findByRole("button", { name: "Byt namn" }));
    fireEvent.click(screen.getByRole("button", { name: "Spara" }));
    expect(await screen.findByText("Säkerhetsinställningarna kan inte ändras när du agerar som en annan användare.")).toBeInTheDocument();
  });

  // kliv-auth.ts:1245 and 1458-1478 create a not_found error after storing a passkey.
  it("explains unfinished passkey setup", async () => {
    vi.mocked(auth.addPasskey).mockRejectedValue(Object.assign(new Error("Saved passkey was not found (not_found)"), { code: "not_found" }));
    renderSecurity();
    fireEvent.click(await screen.findByRole("button", { name: "Lägg till nyckel" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Lägg till nyckel" }).at(-1)!);
    expect(await screen.findByText("Nyckeln blev inte klar. Kontrollera dina inloggningssätt innan du försöker igen.")).toBeInTheDocument();
  });

  it("explains unfinished passkey setup after confirming identity", async () => {
    vi.mocked(auth.addPasskey)
      .mockRejectedValueOnce(Object.assign(new Error("Confirm identity (reauth_required)"), { code: "reauth_required" }))
      .mockRejectedValueOnce(Object.assign(new Error("Saved passkey was not found (not_found)"), { code: "not_found" }));
    renderSecurity();
    fireEvent.click(await screen.findByRole("button", { name: "Lägg till nyckel" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Lägg till nyckel" }).at(-1)!);
    fireEvent.change(await screen.findByPlaceholderText("Ditt lösenord"), { target: { value: "fixture-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Bekräfta", exact: true }));
    expect(await screen.findByText("Nyckeln blev inte klar. Kontrollera dina inloggningssätt innan du försöker igen.")).toBeInTheDocument();
    expect(auth.addPasskey).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(auth.listIdentities).toHaveBeenCalledTimes(2));
  });
  it("refreshes login methods when a stored passkey is not yet listed", async () => {
    vi.mocked(auth.addPasskey).mockRejectedValue(Object.assign(
      new Error("Saved passkey was not found (not_found)"), { code: "not_found" },
    ));
    renderSecurity();
    fireEvent.click(await screen.findByRole("button", { name: "Lägg till nyckel" }));
    vi.mocked(auth.listIdentities).mockResolvedValue([
      { uuid: "identity-1", type: "webauthn", label: "Desk key" },
      { uuid: "identity-2", type: "webauthn", label: "Travel key" },
    ] as never);
    fireEvent.click(screen.getAllByRole("button", { name: "Lägg till nyckel" }).at(-1)!);
    expect(await screen.findByText("Travel key")).toBeInTheDocument();
    expect(auth.listIdentities).toHaveBeenCalledTimes(2);
    expect(auth.addPasskey).toHaveBeenCalledTimes(1);
  });

  describe("signed-in devices", () => {
    // Kliv's test runtime has no window.confirm to spy on, so each case installs its own answer.
    const originalConfirm = window.confirm;
    afterEach(() => {
      window.confirm = originalConfirm;
      vi.restoreAllMocks();
    });

    it("lists each device with its country, last activity and which one this is", async () => {
      renderSecurity();
      const list = await screen.findByRole("list", { name: "Inloggade enheter" });
      const rows = within(list).getAllByRole("listitem");

      expect(rows).toHaveLength(2);
      expect(rows[0]).toHaveTextContent("Chrome on Windows");
      expect(rows[0]).toHaveTextContent("Sverige");
      expect(rows[0]).toHaveTextContent("Den här enheten");
      expect(rows[0]).toHaveTextContent(lastActiveLabel(1761300000));
      expect(rows[1]).toHaveTextContent("Safari on iOS");
      expect(rows[1]).toHaveTextContent("Okänd plats");
      expect(rows[1]).not.toHaveTextContent("Den här enheten");
    });

    it("shows a phone, tablet or desktop icon for each device", async () => {
      vi.mocked(auth.listSessions).mockResolvedValue([
        ...TWO_SESSIONS,
        { device: "Safari on iOS", deviceType: "tablet", country: "JP", lastActiveOn: 1761100000, current: false },
        { device: "Unknown browser", deviceType: "unknown", country: null, lastActiveOn: 1761000000, current: false },
      ] as never);
      renderSecurity();
      const list = await screen.findByRole("list", { name: "Inloggade enheter" });
      const types = within(list).getAllByRole("listitem")
        .map((row: HTMLElement) => row.querySelector("svg[data-device-type]")?.getAttribute("data-device-type"));

      expect(types).toEqual(["desktop", "phone", "tablet", "unknown"]);
      expect(list.querySelector('svg[data-device-type="phone"]')?.getAttribute("class")).toContain("lucide-smartphone");
      expect(list.querySelector('svg[data-device-type="tablet"]')?.getAttribute("class")).toContain("lucide-tablet");
      expect(list.querySelector('svg[data-device-type="desktop"]')?.getAttribute("class")).toContain("lucide-monitor");
    });

    it("sits above the button that signs the other devices out", async () => {
      renderSecurity();
      const list = await screen.findByRole("list", { name: "Inloggade enheter" });
      const button = screen.getByRole("button", { name: "Logga ut från alla andra enheter" });
      expect(list.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("reloads the list after signing out the other devices", async () => {
      window.confirm = vi.fn(() => true);
      vi.mocked(auth.logoutAllDevices).mockResolvedValue(undefined);
      renderSecurity();
      await screen.findByText("Safari on iOS");

      vi.mocked(auth.listSessions).mockResolvedValue([TWO_SESSIONS[0]] as never);
      fireEvent.click(screen.getByRole("button", { name: "Logga ut från alla andra enheter" }));

      await waitFor(() => expect(screen.queryByText("Safari on iOS")).not.toBeInTheDocument());
      expect(auth.listSessions).toHaveBeenCalledTimes(2);
    });

    it("reloads the list after a sign-out that needed the password first", async () => {
      window.confirm = vi.fn(() => true);
      vi.mocked(auth.logoutAllDevices)
        .mockRejectedValueOnce(Object.assign(new Error("Confirm identity (reauth_required)"), { code: "reauth_required" }))
        .mockResolvedValueOnce(undefined);
      renderSecurity();
      await screen.findByText("Safari on iOS");

      vi.mocked(auth.listSessions).mockResolvedValue([TWO_SESSIONS[0]] as never);
      fireEvent.click(screen.getByRole("button", { name: "Logga ut från alla andra enheter" }));
      fireEvent.change(await screen.findByPlaceholderText("Ditt lösenord"), { target: { value: "fixture-password" } });
      fireEvent.click(screen.getByRole("button", { name: "Bekräfta" }));

      await waitFor(() => expect(screen.queryByText("Safari on iOS")).not.toBeInTheDocument());
      expect(auth.logoutAllDevices).toHaveBeenCalledTimes(2);
    });

    it("keeps the rest of the page when the list cannot be loaded", async () => {
      vi.mocked(auth.listSessions).mockRejectedValue(new Error("Failed to list signed-in devices"));
      renderSecurity();

      expect(await screen.findByText("Det gick inte att visa inloggade enheter.")).toBeInTheDocument();
      expect(screen.getByText("Desk key")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Logga ut från alla andra enheter" })).toBeInTheDocument();
    });
  });

  describe("authenticator-app enrollment", () => {
    beforeEach(() => {
      vi.spyOn(globalThis, "fetch");
      vi.spyOn(XMLHttpRequest.prototype, "open");
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("draws the QR code from the inline image without a network request", async () => {
      vi.mocked(auth.enrollTotp).mockResolvedValue(totpEnrollment(FIXTURE_QR) as never);
      renderSecurity();
      fireEvent.click(await screen.findByRole("button", { name: "Slå på verifieringskod" }));

      const qr = await screen.findByRole("img", { name: "QR-kod för din autentiseringsapp" });
      expect(qr).toHaveAttribute("src", FIXTURE_QR);
      for (const image of Array.from(document.querySelectorAll("img"))) {
        expect(image.getAttribute("src")).toMatch(/^data:image\/png;base64,/);
      }
      expect(urlsCarryingTheSecret()).toEqual([]);
      expect(globalThis.fetch).not.toHaveBeenCalled();
      expect(XMLHttpRequest.prototype.open).not.toHaveBeenCalled();
      expect(screen.getByText(FIXTURE_SECRET)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Kopiera" })).toBeInTheDocument();
    });

    it("falls back to the manual-entry code when no inline QR image arrives", async () => {
      vi.mocked(auth.enrollTotp).mockResolvedValue(totpEnrollment() as never);
      renderSecurity();
      fireEvent.click(await screen.findByRole("button", { name: "Slå på verifieringskod" }));

      expect(await screen.findByText("Skriv in den här koden i din autentiseringsapp:")).toBeInTheDocument();
      expect(screen.getByText(FIXTURE_SECRET)).toBeInTheDocument();
      expect(document.querySelector("img")).toBeNull();
      expect(urlsCarryingTheSecret()).toEqual([]);
      expect(globalThis.fetch).not.toHaveBeenCalled();
      expect(XMLHttpRequest.prototype.open).not.toHaveBeenCalled();
    });

    it("refuses a QR value that is a remote URL", async () => {
      vi.mocked(auth.enrollTotp).mockResolvedValue(
        totpEnrollment(`https://qr.example.test/?data=${FIXTURE_SECRET}`) as never,
      );
      renderSecurity();
      fireEvent.click(await screen.findByRole("button", { name: "Slå på verifieringskod" }));

      expect(await screen.findByText("Skriv in den här koden i din autentiseringsapp:")).toBeInTheDocument();
      expect(document.querySelector("img")).toBeNull();
      expect(urlsCarryingTheSecret()).toEqual([]);
      expect(globalThis.fetch).not.toHaveBeenCalled();
      expect(XMLHttpRequest.prototype.open).not.toHaveBeenCalled();
    });
  });
});
