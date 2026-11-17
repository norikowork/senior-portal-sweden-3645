import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AccountHome from "./AccountHome";
import { clearAccountCards, registerAccountCard } from "@/lib/accountHub";

const { mockUseAuth } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

function renderAccountHome() {
  return render(
    <MemoryRouter initialEntries={["/account"]}>
      <Routes>
        <Route path="/account" element={<AccountHome />} />
        <Route path="/" element={<p>Signed out</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AccountHome", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAccountCards();
  });

  it("shows a loading spinner while the session loads", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true, signOut: vi.fn() });

    renderAccountHome();

    expect(screen.getByLabelText("Laddar kontot")).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Ditt konto" })).not.toBeInTheDocument();
  });

  it("renders the signed-in user's display name and email", () => {
    mockUseAuth.mockReturnValue({
      user: { firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" },
      loading: false,
      signOut: vi.fn(),
    });

    renderAccountHome();

    expect(screen.getByText("Ada Lovelace")).toBeVisible();
    expect(screen.getByText("ada@example.com")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Ditt konto" })).toBeVisible();
  });

  it("links to the profile and security pages", () => {
    mockUseAuth.mockReturnValue({
      user: { firstName: "Ada", email: "ada@example.com" },
      loading: false,
      signOut: vi.fn(),
    });

    renderAccountHome();

    expect(screen.getByRole("link", { name: /Profil/ })).toHaveAttribute(
      "href",
      "/account/profile",
    );
    expect(screen.getByRole("link", { name: /Säkerhet/ })).toHaveAttribute(
      "href",
      "/account/security",
    );
  });

  it("signs out before navigating home", async () => {
    const signOut = vi.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({
      user: { firstName: "Ada", email: "ada@example.com" },
      loading: false,
      signOut,
    });

    renderAccountHome();
    fireEvent.click(screen.getByRole("button", { name: "Logga ut" }));

    await waitFor(() => {
      expect(signOut).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Signed out")).toBeVisible();
    });
  });

  it("shows only Profile and Security when no other spine contributed a card", () => {
    mockUseAuth.mockReturnValue({
      user: { firstName: "Ada", email: "ada@example.com" },
      loading: false,
      signOut: vi.fn(),
    });

    renderAccountHome();

    expect(screen.queryByRole("link", { name: /Orders/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Billing/ })).not.toBeInTheDocument();
  });

  it("shows a contributed card and links it where the contributing spine said", () => {
    registerAccountCard({
      key: "orders",
      to: "/account/orders",
      title: "Orders",
      description: "Everything you have bought.",
    });
    mockUseAuth.mockReturnValue({
      user: { firstName: "Ada", email: "ada@example.com" },
      loading: false,
      signOut: vi.fn(),
    });

    renderAccountHome();

    expect(screen.getByRole("link", { name: /Orders/ })).toHaveAttribute(
      "href",
      "/account/orders",
    );
    expect(screen.getByText("Everything you have bought.")).toBeVisible();
  });

  it("keeps Profile and Security ahead of contributed cards", () => {
    registerAccountCard({ key: "orders", to: "/account/orders", title: "Orders", description: "o" });
    mockUseAuth.mockReturnValue({
      user: { firstName: "Ada", email: "ada@example.com" },
      loading: false,
      signOut: vi.fn(),
    });

    renderAccountHome();

    const titles = screen.getAllByRole("link").map((link: HTMLElement) => link.textContent ?? "");
    expect(titles[0]).toContain("Profil");
    expect(titles[1]).toContain("Säkerhet");
    expect(titles[2]).toContain("Orders");
  });
});
