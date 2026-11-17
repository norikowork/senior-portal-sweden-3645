import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Toaster } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import auth from "@/lib/shared/kliv-auth.js";

import AuthPage from "./AuthPage";

vi.mock("@/lib/shared/kliv-auth.js", () => ({
  default: { getUser: vi.fn(), getOAuthProviders: vi.fn(), signUp: vi.fn(), signIn: vi.fn() },
}));

describe("AuthPage signup refusals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth.getUser).mockResolvedValue(null);
    vi.mocked(auth.getOAuthProviders).mockResolvedValue([]);
  });

  for (const [code, message] of [
    ["signup_disabled", "Det går inte att skapa konto på den här webbplatsen."],
    ["account_pending_deletion", "Det här kontot är på väg att tas bort. Kontakta oss om du behöver hjälp."],
  ]) {
    it(`explains the permanent ${code} refusal`, async () => {
      vi.mocked(auth.signUp).mockRejectedValue(Object.assign(new Error(code), { code }));
      render(<MemoryRouter><AuthPage /><Toaster /></MemoryRouter>);
      fireEvent.click(screen.getByRole("button", { name: "Skapa konto" }));
      fireEvent.change(screen.getByPlaceholderText("Ditt namn"), { target: { value: "Ada" } });
      fireEvent.change(screen.getByPlaceholderText("E-post"), { target: { value: "ada@example.test" } });
      fireEvent.change(screen.getByPlaceholderText("Lösenord"), { target: { value: "correct-horse-battery" } });
      fireEvent.click(screen.getByRole("button", { name: "Skapa konto" }));
      expect(await screen.findByText(message)).toBeInTheDocument();
    });
  }
});

describe("AuthPage sign-in refusals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth.getUser).mockResolvedValue(null);
    vi.mocked(auth.getOAuthProviders).mockResolvedValue([]);
  });

  it("says when there were too many sign-in attempts", async () => {
    vi.mocked(auth.signIn).mockRejectedValue(Object.assign(new Error("too_many_attempts"), { code: "too_many_attempts" }));
    render(<MemoryRouter><AuthPage /><Toaster /></MemoryRouter>);
    fireEvent.change(screen.getByPlaceholderText("E-post"), { target: { value: "ada@example.test" } });
    fireEvent.change(screen.getByPlaceholderText("Lösenord"), { target: { value: "correct-horse-battery" } });
    fireEvent.click(screen.getByRole("button", { name: "Logga in" }));
    expect(await screen.findByText("För många inloggningsförsök. Försök igen senare.")).toBeInTheDocument();
  });
});
