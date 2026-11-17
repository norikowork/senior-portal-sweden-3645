import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import RequireAuth from "@/components/auth/RequireAuth";

import AuthPage from "./AuthPage";

const { mockUseAuth } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

let signedIn = false;

function mockSession() {
  const signIn = vi.fn(async () => {
    signedIn = true;
    return { status: "authenticated" };
  });
  const signUp = vi.fn(async () => {
    signedIn = true;
    return { id: "u1" };
  });

  // Read through a live binding: the guard remounts after sign-in and must see
  // the session that the sign-in just established.
  mockUseAuth.mockImplementation(() => ({
    signedIn,
    loading: false,
    signIn,
    signUp,
    signInWithPasskey: vi.fn(),
    submitTotp: vi.fn(),
    submitRecoveryCode: vi.fn(),
    getOAuthProviders: vi.fn().mockResolvedValue([]),
    signInWithOAuth: vi.fn(),
  }));

  return { signIn, signUp };
}

/** Reports where the user actually landed, query string included. */
function LandingProbe({ label }: { label: string }) {
  const location = useLocation();

  return (
    <p>
      {label} at {location.pathname}
      {location.search}
    </p>
  );
}

type Entry = string | { pathname: string; search?: string; state?: unknown };

function renderAuth(entry: Entry) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/login" element={<AuthPage />} />
        <Route path="/" element={<LandingProbe label="Home" />} />
        <Route
          path="/protected"
          element={
            <RequireAuth>
              <LandingProbe label="Protected" />
            </RequireAuth>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

async function signInThroughTheForm() {
  fireEvent.change(screen.getByPlaceholderText("E-post"), {
    target: { value: "ada@example.com" },
  });
  fireEvent.change(screen.getByPlaceholderText("Lösenord"), {
    target: { value: "correct-horse-battery" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Logga in" }));
}

describe("AuthPage return-to-target", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signedIn = false;
    mockSession();
  });

  it("returns a gated visitor to the exact URL they asked for, query string included", async () => {
    // The whole defect, end to end: /protected?foo=bar → gated → sign in →
    // back on /protected?foo=bar rather than a stripped /protected or /.
    renderAuth("/protected?foo=bar");

    expect(await screen.findByRole("heading", { name: "Välkommen" })).toBeVisible();
    await signInThroughTheForm();

    expect(await screen.findByText("Protected at /protected?foo=bar")).toBeVisible();
  });

  it("returns a new signup to the exact URL they asked for", async () => {
    renderAuth("/protected?price=price_1");

    expect(await screen.findByRole("heading", { name: "Välkommen" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Skapa konto" }));
    fireEvent.change(screen.getByPlaceholderText("Ditt namn"), {
      target: { value: "Ada" },
    });
    fireEvent.change(screen.getByPlaceholderText("E-post"), {
      target: { value: "ada@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Lösenord"), {
      target: { value: "correct-horse-battery" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Skapa konto" }));

    expect(
      await screen.findByText("Protected at /protected?price=price_1"),
    ).toBeVisible();
  });

  it("survives a reload of the sign-in page, where router state is gone", async () => {
    // No router state at all — only the URL, which is exactly what a hard reload
    // or a fresh tab leaves behind.
    renderAuth("/login?redirect=%2Fprotected%3Ffoo%3Dbar");

    await signInThroughTheForm();

    expect(await screen.findByText("Protected at /protected?foo=bar")).toBeVisible();
  });

  it("falls back to state.from when only a guard from an older bundle ran", async () => {
    renderAuth({ pathname: "/login", state: { from: "/protected?foo=bar" } });

    await signInThroughTheForm();

    expect(await screen.findByText("Protected at /protected?foo=bar")).toBeVisible();
  });

  it("prefers the reload-safe parameter over router state", async () => {
    renderAuth({
      pathname: "/login",
      search: "?redirect=%2Fprotected%3Ffoo%3Dbar",
      state: { from: "/" },
    });

    await signInThroughTheForm();

    expect(await screen.findByText("Protected at /protected?foo=bar")).toBeVisible();
  });

  it("lands on the home route when no target was recorded", async () => {
    renderAuth("/login");

    await signInThroughTheForm();

    expect(await screen.findByText("Home at /")).toBeVisible();
  });

  it("discards an absolute off-site target", async () => {
    renderAuth("/login?redirect=https%3A%2F%2Fevil.example%2Fsteal");

    await signInThroughTheForm();

    expect(await screen.findByText("Home at /")).toBeVisible();
  });

  it("discards a protocol-relative off-site target", async () => {
    renderAuth("/login?redirect=%2F%2Fevil.example%2Fsteal");

    await signInThroughTheForm();

    expect(await screen.findByText("Home at /")).toBeVisible();
  });
});
