import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SiteLayout from "./SiteLayout";

const { mockUseAuth } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

function renderLayout(path = "/account") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SiteLayout>
        <h1>Page heading</h1>
      </SiteLayout>
    </MemoryRouter>,
  );
}

function header(): HTMLElement {
  return screen.getByRole("banner");
}

describe("SiteLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the page inside main, under a header that links home", () => {
    mockUseAuth.mockReturnValue({ user: null, signedIn: false, loading: false });

    renderLayout();

    expect(within(screen.getByRole("main")).getByRole("heading", { name: "Page heading" })).toBeVisible();
    expect(within(header()).getByRole("link", { name: "Seniorportalen" })).toHaveAttribute("href", "/");
    expect(within(screen.getByRole("contentinfo")).getByRole("link", { name: "Seniorportalen" })).toHaveAttribute("href", "/");
  });

  it("offers a signed-out visitor sign-in and provider sign-up", () => {
    mockUseAuth.mockReturnValue({ user: null, signedIn: false, loading: false });

    renderLayout("/auth/reset");

    expect(within(header()).getByRole("link", { name: "Logga in / Skapa konto" })).toHaveAttribute("href", "/login");
    expect(within(header()).getByRole("link", { name: "Bli utförare" })).toHaveAttribute("href", "/bli-utforare");
    expect(within(header()).queryByRole("link", { name: "Mina sidor" })).not.toBeInTheDocument();
  });

  it("does not offer sign-in on the sign-in page itself", () => {
    mockUseAuth.mockReturnValue({ user: null, signedIn: false, loading: false });

    renderLayout("/login");

    expect(within(header()).queryByRole("link", { name: "Logga in / Skapa konto" })).not.toBeInTheDocument();
  });

  it("links a signed-in member to their pages, without the admin link", () => {
    mockUseAuth.mockReturnValue({ user: { groups: [] }, signedIn: true, loading: false });

    renderLayout();

    expect(within(header()).getByRole("link", { name: "Mina sidor" })).toHaveAttribute("href", "/mina-sidor");
    expect(within(header()).queryByRole("link", { name: "Admin" })).not.toBeInTheDocument();
    expect(within(header()).queryByRole("link", { name: "Logga in / Skapa konto" })).not.toBeInTheDocument();
  });

  it("shows the admin link only to Seniorportalen admins, not sverige.jp site admins", () => {
    mockUseAuth.mockReturnValue({ user: { groups: [{ key: "site-admins" }] }, signedIn: true, loading: false });
    const { unmount } = renderLayout();
    expect(within(header()).queryByRole("link", { name: "Admin" })).not.toBeInTheDocument();
    unmount();

    mockUseAuth.mockReturnValue({ user: { groups: [{ key: "seniorportalen-admins" }] }, signedIn: true, loading: false });
    renderLayout();
    expect(within(header()).getByRole("link", { name: "Admin" })).toHaveAttribute("href", "/admin");
  });

  it("shows neither account control while the session loads", () => {
    mockUseAuth.mockReturnValue({ user: null, signedIn: false, loading: true });

    renderLayout("/auth/reset");

    expect(within(header()).queryByRole("link", { name: "Logga in / Skapa konto" })).not.toBeInTheDocument();
    expect(within(header()).queryByRole("link", { name: "Mina sidor" })).not.toBeInTheDocument();
  });
});
