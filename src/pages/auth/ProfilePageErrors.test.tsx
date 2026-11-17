import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import auth from "@/lib/shared/kliv-auth.js";

import ProfilePage from "./ProfilePage";

vi.mock("@/lib/shared/kliv-auth.js", () => ({
  default: { getUser: vi.fn(), updateUser: vi.fn(), reauthenticateWithPasskey: vi.fn() },
}));

describe("ProfilePage save refusals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth.getUser).mockResolvedValue({ userUuid: "user-1", firstName: "Ada", email: "ada@example.test" });
  });

  it("explains an impersonation refusal from updating the email", async () => {
    // kliv-auth.ts:1458-1478 createError appends body.error and assigns it to code.
    vi.mocked(auth.updateUser).mockRejectedValue(Object.assign(
      new Error("Access denied (impersonation_refused)"), { code: "impersonation_refused" },
    ));
    render(<MemoryRouter><ProfilePage /></MemoryRouter>);
    await screen.findByDisplayValue("ada@example.test");
    fireEvent.change(screen.getByLabelText("E-post"), { target: { value: "grace@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Spara ändringar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Ändringar i profilen kan inte sparas när du agerar som en annan användare.",
    );
    expect(auth.updateUser).toHaveBeenCalledTimes(1);
    expect(auth.reauthenticateWithPasskey).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Bekräfta med nyckel" })).not.toBeInTheDocument();
  });
});
