// Auth and account coverage that a browser can actually establish: the RequireAuth gate on every
// /account leaf, the signup form's real server round trip, and a declared actor's identity through
// the profile form.
//
// DELIBERATELY ABSENT: any assertion that completing the signup form leaves the visitor
// authenticated. Under a scenario run the platform strips every credential from same-origin /api
// requests — that strip is what stops a run from acting as the signed-in builder — and a form
// signup returns its session only as a cookie, so the session never survives. The app still LOOKS
// signed in afterwards because the auth SDK caches the user object the signup response carried,
// which is exactly why the assertions this file used to make were green while proving nothing.
// Do not re-add them until the platform can establish a form session; see
// project/specs/simulator/SCENARIO_PLATFORM_LIMITATIONS.md L2. The return-to-target contract those
// steps were reaching for is covered where a session can be established for real: AuthPage.test.tsx
// (honoring the target) and RequireAuth.test.tsx (recording it).
//
// There is no row write to assert: this spine ships no table because auth identity is
// platform-owned — a scenario actor's profile lives in its run-scoped adm_scenario_principals row,
// which is what the save step below persists to (BI-2718).

import { expect, scenario, step } from "kliv-scenario";

// The world is declared, so the owner below is the only identity in it and the "signed-out
// visitor" steps are signed out as a fact rather than as an assumption about the account.
scenario("account access is gated, and a declared actor's identity is its own", {
  setup: {
    users: { owner: { groups: [], name: "Account owner" } },
  },
}, async ({ page, users, kliv }) => {
  const owner = users.owner;
  const ownerEmail = owner.email;

  await step("a signed-out visitor cannot reach the account hub", async () => {
    await page.goto("/account");

    // Both halves matter: "Välkommen" proves the redirect reached the real sign-in page, while the
    // missing account heading proves protected content did not flash or remain mounted.
    await expect(page.getByRole("heading", { name: "Välkommen", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Ditt konto", exact: true })).not.toBeVisible();
  });

  await step("the signup form's refusal is the server's, not the browser's", async () => {
    // The end-to-end fact the signup form can still prove without a session: the submit reaches
    // the server, and the server answers out of state only it holds. The owner actor was minted
    // into this run's principal registry before this body started, so re-registering that address
    // must be refused — which is also what makes the refusal evidence that the mint was real.
    // AuthPage's inputs carry placeholders rather than labels, so they are addressed by placeholder.
    await page.getByRole("button", { name: "Skapa konto", exact: true }).click();
    await page.getByPlaceholder("Ditt namn", { exact: true }).fill("Impostor");
    await page.getByPlaceholder("E-post", { exact: true }).fill(ownerEmail);
    await page.getByPlaceholder("Lösenord", { exact: true }).fill(`Kliv-${kliv.unique("refused")}-9!`);
    await page.getByRole("button", { name: "Skapa konto", exact: true }).click();

    // The wording, not just that something failed. Reaching this text takes the whole chain: the
    // server answers email_exists, signUp raises it through the SDK's createError helper so the
    // code rides on the message, and AuthPage matches on that code. signUp was the one refusal
    // path that skipped createError, so this line read "Something went wrong. Please try again."
    // until it was fixed — a real customer was never told the address was taken.
    await expect(
      page.getByText("Det finns redan ett konto med den här e-postadressen", { exact: true }),
    ).toBeVisible();
  });

  await step("a refused signup leaves the visitor where they were", async () => {
    // Refused means refused. This is the one post-signup state assertion that holds under a run,
    // because it is the absence of a session rather than the presence of one.
    await expect(page.getByRole("heading", { name: "Ditt konto", exact: true })).not.toBeVisible();
    await expect(page.getByRole("heading", { name: "Välkommen", exact: true })).toBeVisible();
  });

  await step("an isolated actor's own identity reaches the profile form", async () => {
    await owner.page.goto("/account/profile");
    await expect(owner.page.getByRole("heading", { name: "Profil", exact: true })).toBeVisible();
    await expect(owner.page.getByLabel("E-post", { exact: true })).toHaveValue(ownerEmail);

    // The first mount fetches the user from the server: unlike a form signup, this actor carries a
    // real per-actor credential. Leaving for another declared route forces a remount, so the value
    // on return is not component state, but it is the SDK's cached copy of that first read rather
    // than a second server round trip; useAuth's mount calls getUser() without force.
    await owner.page.goto("/account");
    await expect(owner.page.getByText(ownerEmail, { exact: true })).toBeVisible();
    await owner.page.goto("/account/profile");
    await expect(owner.page.getByLabel("E-post", { exact: true })).toHaveValue(ownerEmail);
  });

  await step("a profile save persists to the actor's own identity", async () => {
    await owner.page.getByLabel("Förnamn", { exact: true }).fill("Changed");
    await owner.page.getByRole("button", { name: "Spara ändringar", exact: true }).click();

    // Name and locale are columns adm_scenario_principals carries, so handleUserPut routes the
    // write through IdentityStore.updateUserProfile to the actor's OWN run-scoped row (BI-2718) —
    // self-service works without touching the real registry. Email and password stay refused under
    // a run: email would reserve a real address in the live signup pool, and a password change
    // would diverge from the credential the actor mint issued.
    await expect(owner.page.getByText("Profilen är sparad.", { exact: true })).toBeVisible();
  });

  await step("the saved name is read back after leaving the profile page, so it was persisted not just echoed", async () => {
    // A same-route goto won't remount; /account unmounts the profile. On return, useAuth's mount
    // calls getUser() without force, reading the SDK cache. ProfilePage's post-PUT refresh() forced
    // getUser(true) to GET the stored name, replacing the PUT's potentially unpersisted echo.
    // The remounted field thus shows the server's stored value, not surviving component state.
    await owner.page.goto("/account");
    await expect(owner.page.getByRole("heading", { name: "Ditt konto", exact: true })).toBeVisible();
    await owner.page.goto("/account/profile");
    await expect(owner.page.getByLabel("Förnamn", { exact: true })).toHaveValue("Changed");
  });
});

// All three /account/* routes are wrapped in RequireAuth, so the gate is one mechanism rather
// than three page-local effects. This proves the second leaf really carries it; the third,
// /account/profile, is gated in the deep-link scenario below.
scenario("the security page is gated too", { setup: {} }, async ({ page }) => {
  await step("a signed-out visitor is redirected away from account security", async () => {
    await page.goto("/account/security");

    await expect(page.getByRole("heading", { name: "Välkommen", exact: true })).toBeVisible();
    await expect(page.getByText("Inloggningssätt", { exact: true })).not.toBeVisible();
  });
});

// The gated target is a whole URL, not a pathname. A visitor who followed a link carrying
// parameters must have those parameters recorded, or the page they return to is not the page they
// asked for. What a browser adds over RequireAuth.test.tsx is that the shipped guard writes the
// real address bar, so this asserts the exact encoded target rather than merely that some
// redirect= appeared. Honoring that target on the way back needs an established session, so it
// stays in AuthPage.test.tsx.
scenario("a gated deep link records its whole target in the address bar", { setup: {} }, async ({ page }) => {
  await step("the guard records the whole target, not just its path", async () => {
    await page.goto("/account/profile?highlight=email");

    await expect(page.getByRole("heading", { name: "Välkommen", exact: true })).toBeVisible();
    await expect(page).toHaveURL(/redirect=%2Faccount%2Fprofile%3Fhighlight%3Demail/);
  });

  await step("the sign-in page opens cold from that parameter alone", async () => {
    // A reload, a bookmark, a fresh tab: no router state survives any of them, so the parameter
    // is the only carrier of the target. The page must render from it rather than fault.
    await page.goto("/login?redirect=%2Faccount%2Fsecurity%3Ffrom%3Dreload");

    await expect(page.getByRole("heading", { name: "Välkommen", exact: true })).toBeVisible();
    await expect(page).toHaveURL(/redirect=%2Faccount%2Fsecurity%3Ffrom%3Dreload/);
  });
});

// /verify-sign-in is the page the sign-in verification email links to. A real link needs a
// verification row and the browser cookie the password step set, which a scenario cannot
// establish (the same credential strip as above), so the happy path lives in VerifySignIn.test.tsx.
// What a browser can prove is that the shipped page reaches the server with the token and shows
// the server's refusal, and that a refused link leaves nobody signed in.
scenario("a sign-in verification link that cannot be used says so", { setup: {} }, async ({ page }) => {
  await step("a link the server does not know is refused", async () => {
    await page.goto("/verify-sign-in?token=vt_not_a_real_token");

    await expect(page.getByRole("heading", { name: "Länken går inte att använda", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Tillbaka till inloggningen", exact: true })).toBeVisible();
  });

  await step("the refused link signed nobody in", async () => {
    await page.goto("/account");

    await expect(page.getByRole("heading", { name: "Välkommen", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Ditt konto", exact: true })).not.toBeVisible();
  });

  await step("a link without its token never reaches the server", async () => {
    await page.goto("/verify-sign-in");

    await expect(page.getByRole("heading", { name: "Inloggningslänken är ofullständig", exact: true })).toBeVisible();
  });
});
