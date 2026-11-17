import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Toaster } from "sonner";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ProfilePage from "./ProfilePage";

const { mockUseAuth } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

const user = {
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  userMetadata: { department: "Research", level: "Senior" },
};

function renderProfilePage() {
  return render(
    <MemoryRouter initialEntries={["/account/profile"]}>
      <ProfilePage />
      <Toaster />
    </MemoryRouter>,
  );
}

function mockProfileUser(currentUser: unknown = user) {
  const updateUser = vi.fn().mockResolvedValue(currentUser);
  const refresh = vi.fn().mockResolvedValue(undefined);
  const reauthenticateWithPasskey = vi.fn().mockResolvedValue(undefined);
  const cancelEmailChange = vi.fn().mockResolvedValue({ ...user, pendingEmail: null });
  const resendEmailChange = vi.fn().mockResolvedValue(undefined);
  mockUseAuth.mockReturnValue({
    user: currentUser,
    loading: false,
    updateUser,
    refresh,
    reauthenticateWithPasskey,
    cancelEmailChange,
    resendEmailChange,
  });
  return { updateUser, refresh, reauthenticateWithPasskey, cancelEmailChange, resendEmailChange };
}

describe("ProfilePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the pending address with resend and cancel actions", async () => {
    mockProfileUser({ ...user, pendingEmail: "pending@example.com" });
    renderProfilePage();
    expect(await screen.findByText("Väntar på bekräftelse från pending@example.com. Öppna länken vi skickade dit för att slutföra bytet.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Skicka länken igen" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Avbryt bytet" })).toBeVisible();
  });

  it("does not show pending actions without a pending change", () => {
    mockProfileUser();
    renderProfilePage();
    expect(screen.queryByText(/Väntar på bekräftelse/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Avbryt bytet" })).not.toBeInTheDocument();
  });

  it("resends the pending confirmation and shows a toast", async () => {
    const { resendEmailChange } = mockProfileUser({ ...user, pendingEmail: "pending@example.com" });
    renderProfilePage();
    fireEvent.click(screen.getByRole("button", { name: "Skicka länken igen" }));
    expect(await screen.findByText("Om bytet fortfarande väntar har vi skickat en ny länk till pending@example.com. Det kan ta några minuter innan den kommer fram.")).toBeInTheDocument();
    expect(resendEmailChange).toHaveBeenCalledOnce();
  });

  it("shows resend failures without a success toast", async () => {
    const { resendEmailChange } = mockProfileUser({ ...user, pendingEmail: "pending@example.com" });
    resendEmailChange.mockRejectedValue(new Error("Failed to fetch"));
    renderProfilePage();
    fireEvent.click(screen.getByRole("button", { name: "Skicka länken igen" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to fetch");
    await act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
    expect(screen.queryByText(/har vi skickat en ny länk/)).not.toBeInTheDocument();
  });

  it("cancels and refreshes the user", async () => {
    const actions = mockProfileUser({ ...user, pendingEmail: "pending@example.com" });
    const { cancelEmailChange, refresh } = actions;
    refresh.mockImplementation(async () => {
      mockUseAuth.mockReturnValue({ ...actions, user: { ...user, pendingEmail: null }, loading: false });
    });
    renderProfilePage();
    fireEvent.click(screen.getByRole("button", { name: "Avbryt bytet" }));
    expect(await screen.findByText("Bytet av e-postadress är avbrutet.")).toBeVisible();
    expect(screen.queryByText(/Väntar på bekräftelse/)).not.toBeInTheDocument();
    expect(cancelEmailChange).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("saving the current address cancels without credential proof", async () => {
    const { cancelEmailChange, updateUser } = mockProfileUser({ ...user, pendingEmail: "pending@example.com" });
    renderProfilePage();
    await waitFor(() => expect(screen.getByLabelText("E-post")).toHaveValue(user.email));
    fireEvent.change(screen.getByLabelText("E-post"), { target: { value: user.email.toUpperCase() } });
    fireEvent.click(screen.getByRole("button", { name: "Spara ändringar" }));
    expect(await screen.findByText("Bytet av e-postadress är avbrutet.")).toBeVisible();
    expect(cancelEmailChange).not.toHaveBeenCalled();
    expect(updateUser).toHaveBeenCalledExactlyOnceWith({ email: user.email });
  });

  it("saves changed names without canceling an unedited pending email", async () => {
    const { cancelEmailChange, updateUser, refresh } = mockProfileUser({ ...user, pendingEmail: "pending@example.com" });
    renderProfilePage();
    await waitFor(() => expect(screen.getByLabelText("E-post")).toHaveValue(user.email));
    fireEvent.change(screen.getByLabelText("Förnamn"), { target: { value: "Grace" } });
    fireEvent.click(screen.getByRole("button", { name: "Spara ändringar" }));
    expect(await screen.findByText("Profilen är sparad.")).toBeVisible();
    expect(screen.getByText(/Väntar på bekräftelse från pending@example.com/)).toBeVisible();
    expect(updateUser).toHaveBeenCalledExactlyOnceWith({ firstName: "Grace" });
    expect(cancelEmailChange).not.toHaveBeenCalled();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("saves names and cancels an email edited back to current in one request", async () => {
    const { cancelEmailChange, updateUser } = mockProfileUser({ ...user, pendingEmail: "pending@example.com" });
    renderProfilePage();
    fireEvent.change(screen.getByLabelText("Förnamn"), { target: { value: "Grace" } });
    fireEvent.change(screen.getByLabelText("E-post"), { target: { value: "another@example.com" } });
    fireEvent.change(screen.getByLabelText("E-post"), { target: { value: user.email.toUpperCase() } });
    fireEvent.click(screen.getByRole("button", { name: "Spara ändringar" }));
    expect(await screen.findByText("Bytet av e-postadress är avbrutet. Profilen är sparad.")).toBeVisible();
    expect(updateUser).toHaveBeenCalledExactlyOnceWith({ firstName: "Grace", email: user.email });
    expect(cancelEmailChange).not.toHaveBeenCalled();
  });

  it("does not carry a reverted email edit into a name-only save after another tab stages a change", async () => {
    const actions = mockProfileUser();
    const savedUser = { ...user, firstName: "Grace" };
    actions.refresh.mockImplementationOnce(async () => {
      mockUseAuth.mockReturnValue({ ...actions, user: savedUser, loading: false });
    });
    const { rerender } = renderProfilePage();
    fireEvent.change(screen.getByLabelText("E-post"), { target: { value: "another@example.com" } });
    fireEvent.change(screen.getByLabelText("E-post"), { target: { value: user.email } });
    fireEvent.change(screen.getByLabelText("Förnamn"), { target: { value: "Grace" } });
    fireEvent.click(screen.getByRole("button", { name: "Spara ändringar" }));
    expect(await screen.findByText("Profilen är sparad.")).toBeVisible();
    expect(actions.updateUser).toHaveBeenCalledExactlyOnceWith({ firstName: "Grace" });

    actions.refresh.mockImplementationOnce(async () => {
      mockUseAuth.mockReturnValue({
        ...actions, user: { ...savedUser, pendingEmail: "pending@example.com" }, loading: false,
      });
    });
    await act(async () => {
      await actions.refresh();
      rerender(<MemoryRouter initialEntries={["/account/profile"]}><ProfilePage /></MemoryRouter>);
    });
    expect(screen.getByText(/Väntar på bekräftelse från pending@example.com/)).toBeVisible();
    fireEvent.change(screen.getByLabelText("Efternamn"), { target: { value: "Byron" } });
    fireEvent.click(screen.getByRole("button", { name: "Spara ändringar" }));
    expect(await screen.findByText("Profilen är sparad.")).toBeVisible();
    expect(actions.updateUser).toHaveBeenCalledTimes(2);
    expect(actions.updateUser).toHaveBeenLastCalledWith({ lastName: "Byron" });
    expect(actions.cancelEmailChange).not.toHaveBeenCalled();
    expect(screen.getByText(/Väntar på bekräftelse från pending@example.com/)).toBeVisible();
  });

  it("reports that a cleared last name was saved while canceling an email change", async () => {
    const { cancelEmailChange, updateUser } = mockProfileUser({ ...user, pendingEmail: "pending@example.com" });
    renderProfilePage();
    fireEvent.change(screen.getByLabelText("Efternamn"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("E-post"), { target: { value: "another@example.com" } });
    fireEvent.change(screen.getByLabelText("E-post"), { target: { value: user.email } });
    fireEvent.click(screen.getByRole("button", { name: "Spara ändringar" }));
    expect(await screen.findByText("Bytet av e-postadress är avbrutet. Profilen är sparad.")).toBeVisible();
    expect(updateUser).toHaveBeenCalledExactlyOnceWith({ lastName: "", email: user.email });
    expect(cancelEmailChange).not.toHaveBeenCalled();
  });

  it("shows the pending line after an email save refreshes the user", async () => {
    const actions = mockProfileUser();
    actions.refresh.mockImplementation(async () => {
      mockUseAuth.mockReturnValue({ ...actions, user: { ...user, pendingEmail: "next@example.com" }, loading: false });
    });
    renderProfilePage();
    await waitFor(() => expect(screen.getByLabelText("E-post")).toHaveValue(user.email));
    fireEvent.change(screen.getByLabelText("E-post"), { target: { value: "next@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Spara ändringar" }));
    expect(await screen.findByText(/Väntar på bekräftelse från next@example.com/)).toBeVisible();
    expect(screen.getByLabelText("E-post")).toHaveValue(user.email);
    expect(screen.queryByLabelText("Nuvarande lösenord")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Förnamn"), { target: { value: "Grace" } });
    fireEvent.click(screen.getByRole("button", { name: "Spara ändringar" }));
    expect(await screen.findByText("Profilen är sparad.")).toBeVisible();
    expect(actions.updateUser).toHaveBeenLastCalledWith({ firstName: "Grace" });
    expect(actions.cancelEmailChange).not.toHaveBeenCalled();
  });

  it("shows cancellation errors without reporting success", async () => {
    const { cancelEmailChange, refresh } = mockProfileUser({ ...user, pendingEmail: "pending@example.com" });
    cancelEmailChange.mockRejectedValue(new Error("Access denied"));
    renderProfilePage();
    fireEvent.click(screen.getByRole("button", { name: "Avbryt bytet" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Access denied");
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.queryByText("Bytet av e-postadress är avbrutet.")).not.toBeInTheDocument();
  });

  it("prefills all fields from the signed-in user", async () => {
    mockProfileUser();

    renderProfilePage();

    await waitFor(() => {
      expect(screen.getByLabelText("Förnamn")).toHaveValue("Ada");
      expect(screen.getByLabelText("Efternamn")).toHaveValue("Lovelace");
      expect(screen.getByLabelText("E-post")).toHaveValue("ada@example.com");
    });
  });

  it("blocks an invalid draft without calling updateUser", async () => {
    const { updateUser } = mockProfileUser();
    renderProfilePage();
    await waitFor(() => expect(screen.getByLabelText("Förnamn")).toHaveValue("Ada"));

    fireEvent.change(screen.getByLabelText("Förnamn"), { target: { value: " " } });
    fireEvent.click(screen.getByRole("button", { name: "Spara ändringar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Skriv ditt förnamn");
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("reports an unchanged form without calling updateUser", async () => {
    const { updateUser } = mockProfileUser();
    renderProfilePage();
    await waitFor(() => expect(screen.getByLabelText("Förnamn")).toHaveValue("Ada"));

    fireEvent.click(screen.getByRole("button", { name: "Spara ändringar" }));

    expect(await screen.findByText("Det finns inga ändringar att spara.")).toBeVisible();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("sends only changed fields, refreshes, and reports success", async () => {
    const { updateUser, refresh } = mockProfileUser();
    renderProfilePage();
    await waitFor(() => expect(screen.getByLabelText("Förnamn")).toHaveValue("Ada"));

    fireEvent.change(screen.getByLabelText("Efternamn"), { target: { value: " Byron " } });
    fireEvent.click(screen.getByRole("button", { name: "Spara ändringar" }));

    await waitFor(() => {
      expect(updateUser).toHaveBeenCalledWith({ lastName: "Byron" });
      expect(refresh).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Profilen är sparad.")).toBeVisible();
    });
    expect(Object.keys(updateUser.mock.calls[0][0])).toEqual(["lastName"]);
  });

  it("disables saving until the update finishes", async () => {
    const { updateUser } = mockProfileUser();
    let finishUpdate: () => void = () => undefined;
    const pendingUpdate = new Promise<unknown>(
      (resolve: (value: unknown | PromiseLike<unknown>) => void) => {
        finishUpdate = () => resolve(user);
      },
    );
    updateUser.mockReturnValue(pendingUpdate);
    renderProfilePage();
    await waitFor(() => expect(screen.getByLabelText("Förnamn")).toHaveValue("Ada"));

    fireEvent.change(screen.getByLabelText("Förnamn"), { target: { value: "Grace" } });
    fireEvent.click(screen.getByRole("button", { name: "Spara ändringar" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Spara ändringar" })).toBeDisabled(),
    );
    finishUpdate();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Spara ändringar" })).toBeEnabled(),
    );
  });

  it("surfaces a rejected update's server message and never reports success", async () => {
    const { updateUser, refresh } = mockProfileUser();
    updateUser.mockRejectedValue(new Error("Identity updates are not allowed during this run"));
    renderProfilePage();
    await waitFor(() => expect(screen.getByLabelText("Förnamn")).toHaveValue("Ada"));

    fireEvent.change(screen.getByLabelText("Förnamn"), { target: { value: "Grace" } });
    fireEvent.click(screen.getByRole("button", { name: "Spara ändringar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Det gick inte att spara profilen: Identity updates are not allowed during this run",
    );
    expect(screen.queryByText("Profilen är sparad.")).not.toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("asks for the current password only when the email changes and sends it", async () => {
    const { updateUser } = mockProfileUser();
    renderProfilePage();
    await waitFor(() => expect(screen.getByLabelText("E-post")).toHaveValue("ada@example.com"));
    expect(screen.queryByLabelText("Nuvarande lösenord")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("E-post"), { target: { value: "grace@example.com" } });
    fireEvent.change(screen.getByLabelText("Nuvarande lösenord"), { target: { value: "secret-pass-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Spara ändringar" }));

    await waitFor(() =>
      expect(updateUser).toHaveBeenCalledWith({ email: "grace@example.com", currentPassword: "secret-pass-1" }),
    );
  });

  it("offers a passkey step-up on reauth_required and retries the save once", async () => {
    const { updateUser, reauthenticateWithPasskey } = mockProfileUser();
    updateUser.mockRejectedValueOnce(new Error("Confirm your current password (reauth_required)"));
    renderProfilePage();
    await waitFor(() => expect(screen.getByLabelText("E-post")).toHaveValue("ada@example.com"));

    fireEvent.change(screen.getByLabelText("E-post"), { target: { value: "grace@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Spara ändringar" }));
    fireEvent.click(await screen.findByRole("button", { name: "Bekräfta med nyckel" }));

    await waitFor(() => {
      expect(reauthenticateWithPasskey).toHaveBeenCalledTimes(1);
      expect(updateUser).toHaveBeenCalledTimes(2);
    });
    expect(updateUser.mock.calls[1][0]).toEqual({ email: "grace@example.com" });
  });

  it.each([
    new Error("Passkey verification failed (not_validated)"),
    new DOMException("The operation was canceled", "NotAllowedError"),
  ])("keeps the draft and does not retry after a failed or canceled passkey prompt: %s", async (error: Error) => {
    const { updateUser, reauthenticateWithPasskey } = mockProfileUser();
    updateUser.mockRejectedValueOnce(new Error("Confirm your current password (reauth_required)"));
    reauthenticateWithPasskey.mockRejectedValueOnce(error);
    renderProfilePage();
    await waitFor(() => expect(screen.getByLabelText("E-post")).toHaveValue("ada@example.com"));

    fireEvent.change(screen.getByLabelText("E-post"), { target: { value: "grace@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Spara ändringar" }));
    fireEvent.click(await screen.findByRole("button", { name: "Bekräfta med nyckel" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Bekräftelsen med nyckel avbröts eller misslyckades. Försök igen, eller logga ut och logga in igen.",
    );
    expect(updateUser).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("E-post")).toHaveValue("grace@example.com");
    expect(screen.getByRole("button", { name: "Bekräfta med nyckel" })).toBeEnabled();
  });

  it("does not resend a typed current password after a passkey step-up", async () => {
    const { updateUser } = mockProfileUser();
    updateUser.mockRejectedValueOnce(new Error("Confirm your current password (reauth_required)"));
    renderProfilePage();
    await waitFor(() => expect(screen.getByLabelText("E-post")).toHaveValue("ada@example.com"));

    fireEvent.change(screen.getByLabelText("E-post"), { target: { value: "grace@example.com" } });
    fireEvent.change(screen.getByLabelText("Nuvarande lösenord"), { target: { value: "mistyped" } });
    fireEvent.click(screen.getByRole("button", { name: "Spara ändringar" }));
    fireEvent.click(await screen.findByRole("button", { name: "Bekräfta med nyckel" }));

    await waitFor(() => expect(updateUser).toHaveBeenCalledTimes(2));
    expect(updateUser.mock.calls[1][0]).toEqual({ email: "grace@example.com" });
  });

  it("renders string profile metadata as read-only details", () => {
    mockProfileUser();

    renderProfilePage();

    expect(screen.getByRole("heading", { name: "Profiluppgifter" })).toBeVisible();
    expect(screen.getByText("department")).toBeVisible();
    expect(screen.getByText("Research")).toBeVisible();
    expect(screen.getByText("level")).toBeVisible();
    expect(screen.getByText("Senior")).toBeVisible();
  });

  it("shows the profile metadata empty state", () => {
    mockProfileUser({ firstName: "Ada", lastName: "", email: "ada@example.com" });

    renderProfilePage();

    expect(screen.getByText("Inga profiluppgifter sparade än.")).toBeVisible();
  });
});
