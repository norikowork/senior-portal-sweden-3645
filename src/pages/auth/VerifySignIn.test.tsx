import { render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import auth from "@/lib/shared/kliv-auth.js";

import VerifySignIn from "./VerifySignIn";

vi.mock("@/lib/shared/kliv-auth.js", () => ({
  default: { user: null, getUser: vi.fn(), verifySignIn: vi.fn() },
}));

const refusal = (code: string) => Object.assign(new Error(`Refused (${code})`), { code });

function Landing() {
  const location = useLocation();
  return <p>Landed at {location.pathname}{location.search}</p>;
}

function renderVerify(path: string) {
  return render(
    <StrictMode>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/verify-sign-in" element={<VerifySignIn />} />
          <Route path="*" element={<Landing />} />
        </Routes>
      </MemoryRouter>
    </StrictMode>,
  );
}

describe("VerifySignIn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(auth.getUser).mockResolvedValue(null);
  });

  it("verifies the link's token once and lands on the page the sign-in was headed for", async () => {
    localStorage.setItem("auth_basic.signInTarget", "/account/security?from=mail");
    vi.mocked(auth.verifySignIn).mockResolvedValue({ userUuid: "u-1", email: "ada@example.test" } as never);
    renderVerify("/verify-sign-in?token=vt_link_token");

    expect(await screen.findByText("Landed at /account/security?from=mail")).toBeInTheDocument();
    // StrictMode runs effects twice; a second call would burn the single-use token.
    expect(auth.verifySignIn).toHaveBeenCalledTimes(1);
    expect(auth.verifySignIn).toHaveBeenCalledWith({ token: "vt_link_token" });
  });

  it("lands on the home page when no target was remembered", async () => {
    vi.mocked(auth.verifySignIn).mockResolvedValue({ userUuid: "u-1" } as never);
    renderVerify("/verify-sign-in?token=vt_link_token");
    expect(await screen.findByText("Landed at /")).toBeInTheDocument();
  });

  it("asks for the browser that signed in when the link is opened elsewhere", async () => {
    vi.mocked(auth.verifySignIn).mockRejectedValue(refusal("verification_other_browser"));
    renderVerify("/verify-sign-in?token=vt_link_token");

    expect(await screen.findByRole("heading", { name: "Öppna länken i webbläsaren där du loggade in" })).toBeInTheDocument();
    expect(screen.getByText(/fungerar en inloggningslänk bara i webbläsaren där du skrev ditt lösenord/)).toBeInTheDocument();
  });

  it("says an expired or used link can't be used, and offers sign-in", async () => {
    vi.mocked(auth.verifySignIn).mockRejectedValue(refusal("verification_invalid"));
    renderVerify("/verify-sign-in?token=vt_used_token");

    expect(await screen.findByRole("heading", { name: "Länken går inte att använda" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tillbaka till inloggningen" })).toHaveAttribute("href", "/login");
  });

  it("explains that verification is unavailable", async () => {
    vi.mocked(auth.verifySignIn).mockRejectedValue(refusal("verification_unavailable"));
    renderVerify("/verify-sign-in?token=vt_link_token");
    expect(await screen.findByRole("heading", { name: "Inloggningen kan inte verifieras" })).toBeInTheDocument();
  });

  it("does not call the server for a link without a token", async () => {
    renderVerify("/verify-sign-in");

    expect(await screen.findByRole("heading", { name: "Inloggningslänken är ofullständig" })).toBeInTheDocument();
    expect(auth.verifySignIn).not.toHaveBeenCalled();
  });

  it("shows progress while the link is being checked", async () => {
    vi.mocked(auth.verifySignIn).mockReturnValue(new Promise(() => {}) as never);
    renderVerify("/verify-sign-in?token=vt_link_token");
    expect(await screen.findByRole("heading", { name: "Bekräftar din inloggning" })).toBeInTheDocument();
  });
});
