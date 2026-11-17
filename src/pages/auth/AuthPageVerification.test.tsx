import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import auth from "@/lib/shared/kliv-auth.js";

import AuthPage from "./AuthPage";

vi.mock("@/lib/shared/kliv-auth.js", () => ({
  default: { user: null, getUser: vi.fn(), getOAuthProviders: vi.fn(), signIn: vi.fn(), verifySignIn: vi.fn() },
}));

const refusal = (code: string) => Object.assign(new Error(`Refused (${code})`), { code });

function Landing() {
  const location = useLocation();
  return <p>Landed at {location.pathname}{location.search}</p>;
}

function renderLogin(path = "/login?redirect=%2Faccount%2Fsecurity") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<AuthPage />} />
        <Route path="*" element={<Landing />} />
      </Routes>
      <Toaster />
    </MemoryRouter>,
  );
}

async function signInFromANewBrowser() {
  vi.mocked(auth.signIn).mockResolvedValue({ status: "verification_required", email: "a•••@example.test" } as never);
  fireEvent.change(screen.getByPlaceholderText("E-post"), { target: { value: "ada@example.test" } });
  fireEvent.change(screen.getByPlaceholderText("Lösenord"), { target: { value: "correct-horse-battery" } });
  fireEvent.click(screen.getByRole("button", { name: "Logga in" }));
  return await screen.findByText(/Vi har skickat en inloggningslänk och en verifieringskod med 6 siffror till/);
}

function enterCode(code: string) {
  fireEvent.change(screen.getByPlaceholderText("Verifieringskod (6 siffror)"), { target: { value: code } });
  fireEvent.click(screen.getByRole("button", { name: "Bekräfta koden" }));
}

describe("AuthPage sign-in verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(auth.getUser).mockResolvedValue(null);
    vi.mocked(auth.getOAuthProviders).mockResolvedValue([]);
  });

  it("asks a new browser to check the masked address, without the password form", async () => {
    renderLogin();
    const notice = await signInFromANewBrowser();

    expect(notice).toHaveTextContent("a•••@example.test");
    expect(screen.getByText("Kolla din e-post")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Lösenord")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Logga in med nyckel (passkey)" })).not.toBeInTheDocument();
  });

  it("keeps only six digits of what is typed into the code field", async () => {
    renderLogin();
    await signInFromANewBrowser();
    fireEvent.change(screen.getByPlaceholderText("Verifieringskod (6 siffror)"), { target: { value: "12 34-5678" } });
    expect(screen.getByPlaceholderText("Verifieringskod (6 siffror)")).toHaveValue("123456");
  });

  it("signs in with the emailed code and goes where the visitor was headed", async () => {
    vi.mocked(auth.verifySignIn).mockResolvedValue({ userUuid: "u-1", email: "ada@example.test" } as never);
    renderLogin();
    await signInFromANewBrowser();
    enterCode("123456");

    expect(await screen.findByText("Landed at /account/security")).toBeInTheDocument();
    expect(auth.verifySignIn).toHaveBeenCalledWith({ code: "123456" });
    expect(localStorage.getItem("auth_basic.signInTarget")).toBeNull();
  });

  it("remembers the target for the emailed link, which opens in another tab", async () => {
    renderLogin();
    await signInFromANewBrowser();
    expect(localStorage.getItem("auth_basic.signInTarget")).toBe("/account/security");
  });

  it("lets a wrong code be corrected", async () => {
    vi.mocked(auth.verifySignIn).mockRejectedValueOnce(refusal("verification_invalid"));
    renderLogin();
    await signInFromANewBrowser();
    enterCode("000000");

    expect(await screen.findByText("Koden är fel eller har gått ut. Titta i mejlet och försök igen.")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Verifieringskod (6 siffror)")).toBeInTheDocument();
  });

  it("returns to the sign-in form once the guesses are spent", async () => {
    vi.mocked(auth.verifySignIn).mockRejectedValueOnce(refusal("too_many_attempts"));
    renderLogin();
    await signInFromANewBrowser();
    enterCode("999999");

    expect(await screen.findByText("Logga in igen för att få en ny kod.")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Lösenord")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Verifieringskod (6 siffror)")).not.toBeInTheDocument();
  });

  it("explains a sign-in refused because the verification email could not be sent", async () => {
    vi.mocked(auth.signIn).mockRejectedValue(refusal("verification_unavailable"));
    renderLogin();
    fireEvent.change(screen.getByPlaceholderText("E-post"), { target: { value: "ada@example.test" } });
    fireEvent.change(screen.getByPlaceholderText("Lösenord"), { target: { value: "correct-horse-battery" } });
    fireEvent.click(screen.getByRole("button", { name: "Logga in" }));

    expect(await screen.findByText("Vi kunde inte bekräfta din inloggning just nu. Försök igen senare eller kontakta oss.")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Lösenord")).toBeInTheDocument();
  });

  it("follows the emailed link signing this browser in from another tab", async () => {
    renderLogin();
    await signInFromANewBrowser();
    vi.mocked(auth.getUser).mockResolvedValue({ userUuid: "u-1", email: "ada@example.test" } as never);
    localStorage.removeItem("auth_basic.signInTarget");
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: "auth_basic.signInTarget", newValue: null }));
    });

    expect(await screen.findByText("Landed at /account/security")).toBeInTheDocument();
    expect(auth.getUser).toHaveBeenLastCalledWith(true);
    expect(auth.verifySignIn).not.toHaveBeenCalled();
  });

  it("does not count a session another member already had in this browser", async () => {
    renderLogin();
    await signInFromANewBrowser();
    vi.mocked(auth.getUser).mockResolvedValue({ userUuid: "u-2", email: "grace@example.test" } as never);
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });

    await waitFor(() => expect(auth.getUser).toHaveBeenLastCalledWith(true));
    expect(screen.getByText("Kolla din e-post")).toBeInTheDocument();
    expect(screen.queryByText("Landed at /account/security")).not.toBeInTheDocument();
  });

  it("stays on the check-your-email step while nobody signed in elsewhere", async () => {
    renderLogin();
    await signInFromANewBrowser();
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });

    await waitFor(() => expect(auth.getUser).toHaveBeenLastCalledWith(true));
    expect(screen.getByText("Kolla din e-post")).toBeInTheDocument();
    expect(localStorage.getItem("auth_basic.signInTarget")).toBe("/account/security");
  });

  it("does not look for a sign-in elsewhere before the email step", async () => {
    renderLogin();
    await screen.findByPlaceholderText("Lösenord");
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(auth.getUser).not.toHaveBeenCalledWith(true);
  });

  it("goes back to the sign-in form on request", async () => {
    renderLogin();
    await signInFromANewBrowser();
    fireEvent.click(screen.getByRole("button", { name: "Tillbaka till inloggningen" }));
    expect(screen.getByPlaceholderText("Lösenord")).toBeInTheDocument();
  });
});
