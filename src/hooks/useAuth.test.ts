import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAuth } from "./useAuth";

type Member = { userUuid: string; email: string; pendingEmail?: string | null; groups?: string[] };

/**
 * Stands in for kliv-auth the way the hook sees it: `user` is the SDK's stored member, and a
 * change of member stores the new one before announcing `kliv:auth-changed`, as the SDK does.
 * `vi.fn()` takes no type arguments: an installed app type-checks its tests against an untyped
 * `vitest` module.
 */
const { fakeAuth } = vi.hoisted(() => {
  const fakeAuth = {
    user: null as Member | null,
    getUser: vi.fn(),
    signIn: vi.fn(),
    verifySignIn: vi.fn(),
    listSessions: vi.fn(),
    signOut: vi.fn(),
    cancelEmailChange: vi.fn(),
    changeMember(next: Member | null) {
      fakeAuth.user = next;
      window.dispatchEvent(new Event("kliv:auth-changed"));
    },
  };
  return { fakeAuth };
});

vi.mock("@/lib/shared/kliv-auth.js", () => ({ default: fakeAuth }));

const ada: Member = { userUuid: "u-ada", email: "ada@example.test" };
const bob: Member = { userUuid: "u-bob", email: "bob@example.test" };

/** A promise the test settles by hand, to hold a call open. */
function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

async function mountSettled(initial: Member | null) {
  fakeAuth.user = initial;
  fakeAuth.getUser.mockResolvedValue(initial);
  let renders = 0;
  const hook = renderHook(() => {
    renders += 1;
    return useAuth();
  });
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return { ...hook, renders: () => renders };
}

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fakeAuth.user = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads the signed-in member once, without forcing a server read", async () => {
    const { result } = await mountSettled(ada);

    expect(result.current.user).toEqual(ada);
    expect(result.current.signedIn).toBe(true);
    expect(fakeAuth.getUser).toHaveBeenCalledTimes(1);
    expect(fakeAuth.getUser).toHaveBeenCalledWith();
  });

  it("starts loading and signed out until the first read answers", async () => {
    const first = deferred<Member | null>();
    fakeAuth.getUser.mockReturnValue(first.promise);

    const { result } = renderHook(() => useAuth());

    expect(result.current.loading).toBe(true);
    expect(result.current.signedIn).toBe(false);
    await act(async () => first.resolve(null));
    expect(result.current.loading).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it("follows a sign-in made elsewhere on the page", async () => {
    const { result } = await mountSettled(null);

    act(() => fakeAuth.changeMember(ada));

    expect(result.current.user).toEqual(ada);
    expect(result.current.signedIn).toBe(true);
    expect(fakeAuth.getUser).toHaveBeenCalledTimes(1);
  });

  it("follows a sign-out made elsewhere on the page", async () => {
    const { result } = await mountSettled(ada);

    act(() => fakeAuth.changeMember(null));

    expect(result.current.user).toBeNull();
    expect(result.current.signedIn).toBe(false);
    expect(result.current.loading).toBe(false);
  });

  it("follows a change from one member straight to another", async () => {
    const { result } = await mountSettled(ada);

    act(() => fakeAuth.changeMember(bob));

    expect(result.current.user).toEqual(bob);
    expect(result.current.signedIn).toBe(true);
    expect(fakeAuth.getUser).toHaveBeenCalledTimes(1);
  });

  it("settles a change announced while the first read is still open", async () => {
    const first = deferred<Member | null>();
    fakeAuth.getUser.mockReturnValue(first.promise);
    const { result } = renderHook(() => useAuth());

    act(() => fakeAuth.changeMember(bob));
    expect(result.current.loading).toBe(false);
    expect(result.current.user).toEqual(bob);

    await act(async () => first.resolve(ada));
    expect(result.current.user).toEqual(bob);
  });

  it("does not let a refresh that answers late undo a sign-out made meanwhile", async () => {
    const { result } = await mountSettled(ada);
    const pending = deferred<Member | null>();
    fakeAuth.getUser.mockReturnValue(pending.promise);

    let refreshed: Promise<Member | null> = Promise.resolve(null);
    act(() => {
      refreshed = result.current.refresh();
    });
    act(() => fakeAuth.changeMember(null));
    await act(async () => {
      pending.resolve(bob);
      await refreshed;
    });

    expect(result.current.user).toBeNull();
    expect(result.current.loading).toBe(false);
    await expect(refreshed).resolves.toBeNull();
  });

  it("returns the member a refresh found, read from the server", async () => {
    const { result } = await mountSettled(null);
    fakeAuth.getUser.mockResolvedValue(ada);

    let found: Member | null = null;
    await act(async () => {
      found = await result.current.refresh();
    });

    expect(fakeAuth.getUser).toHaveBeenLastCalledWith(true);
    expect(found).toEqual(ada);
    expect(result.current.user).toEqual(ada);
  });

  it("does not let a sign-in that answers late undo a sign-out made meanwhile", async () => {
    const { result } = await mountSettled(bob);
    const pending = deferred<{ status: string; user: Member }>();
    fakeAuth.signIn.mockReturnValue(pending.promise);

    let signedIn: Promise<unknown> = Promise.resolve();
    act(() => {
      signedIn = result.current.signIn(ada.email, "correct horse");
    });
    act(() => fakeAuth.changeMember(null));
    await act(async () => {
      pending.resolve({ status: "authenticated", user: ada });
      await signedIn;
    });

    expect(result.current.user).toBeNull();
    expect(result.current.signedIn).toBe(false);
  });

  it("ends on the SDK's member when a change was announced while its own call was in flight", async () => {
    const pendingChange: Member = { ...ada, pendingEmail: "ada.new@example.test" };
    const regrouped: Member = { ...pendingChange, groups: ["editors"] };
    const cancelled: Member = { ...regrouped, pendingEmail: null };
    const { result } = await mountSettled(pendingChange);
    const pending = deferred<Member>();
    fakeAuth.cancelEmailChange.mockReturnValue(pending.promise);

    let cancelling: Promise<unknown> = Promise.resolve();
    act(() => {
      cancelling = result.current.cancelEmailChange();
    });
    act(() => fakeAuth.changeMember(regrouped));
    await act(async () => {
      fakeAuth.user = cancelled;
      pending.resolve(cancelled);
      await cancelling;
    });

    expect(result.current.user).toEqual(cancelled);
    expect(result.current.user).toEqual(fakeAuth.user);
  });

  it("takes a profile change returned by its own call when the member stays the same", async () => {
    const renamed: Member = { ...ada, email: "ada.lovelace@example.test" };
    fakeAuth.signIn.mockResolvedValue({ status: "authenticated", user: renamed });
    const { result } = await mountSettled(ada);

    await act(async () => {
      await result.current.signIn(ada.email, "correct horse");
    });

    expect(result.current.user).toEqual(renamed);
  });

  it("keeps two mounted readers in step when one of them signs out", async () => {
    fakeAuth.user = ada;
    fakeAuth.getUser.mockResolvedValue(ada);
    fakeAuth.signOut.mockImplementation(async () => fakeAuth.changeMember(null));
    const header = renderHook(() => useAuth());
    const page = renderHook(() => useAuth());
    await waitFor(() => expect(header.result.current.signedIn).toBe(true));
    await waitFor(() => expect(page.result.current.signedIn).toBe(true));

    await act(async () => {
      await page.result.current.signOut();
    });

    expect(header.result.current.signedIn).toBe(false);
    expect(page.result.current.signedIn).toBe(false);
    expect(fakeAuth.getUser).toHaveBeenCalledTimes(2);
  });

  it("signs in through the hook without a second read of the member", async () => {
    fakeAuth.signIn.mockImplementation(async () => {
      fakeAuth.changeMember(ada);
      return { status: "authenticated", user: ada };
    });
    const { result } = await mountSettled(null);

    await act(async () => {
      await result.current.signIn(ada.email, "correct horse");
    });

    expect(result.current.user).toEqual(ada);
    expect(fakeAuth.getUser).toHaveBeenCalledTimes(1);
  });

  it("signs in with a verified new device and holds the member it returns", async () => {
    fakeAuth.verifySignIn.mockImplementation(async () => {
      fakeAuth.changeMember(ada);
      return ada;
    });
    const { result } = await mountSettled(null);

    await act(async () => {
      await result.current.verifySignIn({ code: "123456" });
    });

    expect(fakeAuth.verifySignIn).toHaveBeenCalledWith({ code: "123456" });
    expect(result.current.user).toEqual(ada);
    expect(result.current.signedIn).toBe(true);
    expect(fakeAuth.getUser).toHaveBeenCalledTimes(1);
  });

  it("leaves the member unchanged when verification is refused", async () => {
    fakeAuth.verifySignIn.mockRejectedValue(Object.assign(new Error("verification_invalid"), { code: "verification_invalid" }));
    const { result } = await mountSettled(null);

    await act(async () => {
      await expect(result.current.verifySignIn({ token: "vt_used" })).rejects.toMatchObject({ code: "verification_invalid" });
    });

    expect(result.current.user).toBeNull();
  });

  it("lists sessions straight from the SDK", async () => {
    const sessions = [{ device: "Chrome on Windows", deviceType: "desktop", country: "SE", lastActiveOn: 1761300000, current: true }];
    fakeAuth.listSessions.mockResolvedValue(sessions);
    const { result } = await mountSettled(ada);

    await expect(result.current.listSessions()).resolves.toEqual(sessions);
  });

  it("renders a bounded number of times per change and never feeds back into itself", async () => {
    const { renders } = await mountSettled(ada);
    const settled = renders();

    act(() => fakeAuth.changeMember(bob));
    act(() => fakeAuth.changeMember(null));
    await act(async () => new Promise<void>((resolve) => setTimeout(resolve, 0)));

    expect(renders() - settled).toBeLessThanOrEqual(2);
    expect(fakeAuth.getUser).toHaveBeenCalledTimes(1);
  });

  it("stops listening when it unmounts", async () => {
    const added = vi.spyOn(window, "addEventListener");
    const removed = vi.spyOn(window, "removeEventListener");
    const { unmount } = await mountSettled(ada);
    const subscription = added.mock.calls.find((call: unknown[]) => call[0] === "kliv:auth-changed");
    expect(subscription).toBeDefined();

    unmount();

    expect(removed).toHaveBeenCalledWith("kliv:auth-changed", subscription?.[1]);
  });
});
