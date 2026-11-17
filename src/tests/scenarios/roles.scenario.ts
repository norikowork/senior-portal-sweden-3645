// The three roles: customer (signed-in requester), provider (approved application), and
// Seniorportalen admin (`seniorportalen-admins`, deliberately NOT sverige.jp's `site-admins`).
//
// Photo upload can't be driven from a scenario (no file-input API), and a declared row can't name
// an actor's uuid, so the pending application is a fixture owned by a placeholder user. That
// leaves "the provider sees requests addressed to them" uncovered here.

import { expect, flow, scenario, step } from "kliv-scenario";

function check(cond: boolean, message: string) {
  if (!cond) throw new Error(message);
}

flow("an application is reviewed, published and receives a customer's request", () => {
  scenario("admin approves a pending application and it goes live", {
    setup: {
      users: {
        admin: { name: "Admin Ann", groups: ["seniorportalen-admins"] },
        customer: { name: "Greta Kund" },
        other: { name: "Olle Annan" },
        visitor: "anonymous",
      },
      files: { "/provider-photos/seed-provider/face.jpg": { text: "placeholder", type: "image/jpeg" } },
      database: [{
        table: "provider_applications",
        rows: [{
          user_uuid: "seed-provider", contact_name: "Per Utförare", company_name: "Pers Trädgård AB",
          vat_number: "SE556012579001", vat_status: "verified", category: "Trädgård", city: "Uppsala",
          description: "Gräsklippning och häckklippning", price_from: 350, rut: 1, phone: "070-111 22 33",
          photo_path: "/content/provider-photos/seed-provider/face.jpg", status: "pending",
        }],
      }],
    },
  }, async ({ users }) => {
    await step("an ordinary customer is refused the admin page and sees no application", async () => {
      await users.customer.page.goto("/admin");
      await expect(users.customer.page.getByText("Du har inte behörighet till den här sidan.")).toBeVisible();
      await expect(users.customer.page.getByText("Pers Trädgård AB")).not.toBeVisible();
    });

    await step("the application is not public before approval", async () => {
      await users.visitor.page.goto("/");
      await expect(users.visitor.page.getByRole("heading", { name: "Vad behöver du hjälp med?" })).toBeVisible();
      await expect(users.visitor.page.getByText("Pers Trädgård AB")).not.toBeVisible();
    });

    await step("the admin sees it with its VAT check and approves it", async () => {
      const p = users.admin.page;
      await p.goto("/admin");
      await expect(p.getByText("Pers Trädgård AB")).toBeVisible();
      await expect(p.getByText("Bekräftat i VIES")).toBeVisible();
      await p.getByRole("button", { name: "Godkänn och publicera" }).click();
      await expect(p.getByText("Inga ansökningar att granska.")).toBeVisible();
    });

    await step("the listing is now public, marked as new", async () => {
      await users.visitor.page.goto("/");
      await expect(users.visitor.page.getByRole("heading", { name: "Pers Trädgård AB" })).toBeVisible();
      await expect(users.visitor.page.getByText("Ny utförare").first()).toBeVisible();
    });

    await step("approval publishes the applicant's face photo as the listing's profile picture", async () => {
      const card = users.visitor.page.getByRole("article").filter({ hasText: "Pers Trädgård AB" });
      await expect(card.getByRole("img", { name: "Foto på Pers Trädgård AB" })).toBeVisible();
    });
  });

  scenario("only a signed-in customer can request help, and only they see it", async ({ users }) => {
    await step("a signed-out visitor is sent to sign in instead of the form", async () => {
      const p = users.visitor.page;
      await p.goto("/");
      await p.getByRole("article").filter({ hasText: "Pers Trädgård AB" }).getByRole("button", { name: "Be om hjälp" }).click();
      await expect(p.getByRole("heading", { name: "Välkommen" })).toBeVisible();
    });

    await step("the customer sends a request", async () => {
      const p = users.customer.page;
      await p.goto("/");
      await p.getByRole("article").filter({ hasText: "Pers Trädgård AB" }).getByRole("button", { name: "Be om hjälp" }).click();
      await p.getByPlaceholder("Ditt namn").fill("Greta Kund");
      await p.getByPlaceholder("Telefonnummer").fill("070-999 88 77");
      await p.getByPlaceholder("Vad behöver du hjälp med?").fill("Klippa häcken i maj");
      await p.getByRole("button", { name: "Skicka förfrågan" }).click();
      await expect(p.getByText("Tack! Din förfrågan är skickad.")).toBeVisible();
    });

    await step("the customer sees it under their own requests", async () => {
      await users.customer.page.goto("/mina-sidor");
      await expect(users.customer.page.getByText("Klippa häcken i maj")).toBeVisible();
    });

    await step("another member cannot see it", async () => {
      await users.other.page.goto("/mina-sidor");
      await expect(users.other.page.getByText("Du har inte skickat några förfrågningar än.")).toBeVisible();
      await expect(users.other.page.getByText("Klippa häcken i maj")).not.toBeVisible();
    });

    await step("the admin sees it among all requests", async () => {
      const p = users.admin.page;
      await p.goto("/admin");
      await p.getByRole("tab", { name: "Förfrågningar" }).click();
      await expect(p.getByText("Klippa häcken i maj")).toBeVisible();
    });
  });
});

scenario("an admin edits and deletes listings; an ordinary member cannot", {
  setup: {
    users: {
      admin: { name: "Admin Ann", groups: ["seniorportalen-admins"] },
      member: { name: "Vanlig Medlem" },
      visitor: "anonymous",
    },
    database: [{
      table: "providers",
      rows: [
        { name: "Hemfint Städ", category: "Städning", city: "Stockholm", description: "Trygg hemstädning", price_from: 320, rating: 4.8, reviews: 214, rut: 1 },
        { name: "Fixaren Lars", category: "Hantverkare", city: "Uppsala", description: "Små reparationer", price_from: 390, rating: 4.7, reviews: 176, rut: 1 },
      ],
    }],
  },
}, async ({ users }) => {
  await step("a member's direct write to a listing changes nothing", async () => {
    // RLS refuses non-admin updates silently (200, no rows changed), so the proof is the page.
    await users.member.request("/api/v2/database/providers?name=eq.Hemfint%20St%C3%A4d", {
      method: "PUT", body: { name: "Kapad" },
    });
    await users.visitor.page.goto("/");
    await expect(users.visitor.page.getByRole("heading", { name: "Hemfint Städ" })).toBeVisible();
    await expect(users.visitor.page.getByRole("heading", { name: "Kapad" })).not.toBeVisible();
  });

  await step("the admin renames a listing and it changes on the home page", async () => {
    const p = users.admin.page;
    await p.goto("/admin");
    await p.getByRole("tab", { name: "Utförare" }).click();
    await p.getByRole("listitem").filter({ hasText: "Hemfint Städ" }).getByRole("button", { name: "Redigera" }).click();
    await p.getByLabel("Namn").fill("Hemfint Städ AB");
    await p.getByLabel("Ort").fill("Solna");
    await p.getByRole("button", { name: "Spara" }).click();
    await expect(p.getByText("Sparat.")).toBeVisible();

    await users.visitor.page.goto("/");
    await expect(users.visitor.page.getByRole("heading", { name: "Hemfint Städ AB" })).toBeVisible();
    await expect(users.visitor.page.getByText("📍 Solna")).toBeVisible();
  });

  await step("the admin resets a listing's reviews and it shows as new", async () => {
    const p = users.admin.page;
    await p.getByRole("listitem").filter({ hasText: "Hemfint Städ AB" }).getByRole("button", { name: "Redigera" }).click();
    await p.getByRole("button", { name: "Nollställ omdömen" }).click();
    await expect(p.getByText("Omdömena är nollställda.")).toBeVisible();
    await users.visitor.page.goto("/");
    await expect(users.visitor.page.getByRole("article").filter({ hasText: "Hemfint Städ AB" }).getByText("Ny utförare")).toBeVisible();
  });

  await step("the admin deletes a listing and it leaves the home page", async () => {
    const p = users.admin.page;
    await p.getByRole("listitem").filter({ hasText: "Fixaren Lars" }).getByRole("button", { name: "Ta bort" }).click();
    await p.getByRole("alertdialog").getByRole("button", { name: "Ta bort" }).click();
    await expect(p.getByText("Fixaren Lars är borttagen från sajten.")).toBeVisible();

    await users.visitor.page.goto("/");
    await expect(users.visitor.page.getByRole("heading", { name: "Hemfint Städ AB" })).toBeVisible();
    await expect(users.visitor.page.getByRole("heading", { name: "Fixaren Lars" })).not.toBeVisible();
  });
});

scenario("only Seniorportalen admins can review; sverige.jp site admins cannot", {
  setup: {
    users: {
      sverigeAdmin: { name: "Sverige Admin", groups: ["site-admins"] },
      member: { name: "Vanlig Medlem" },
    },
  },
}, async ({ users }) => {
  await step("a sverige.jp site admin is refused by the review function", async () => {
    const res = await users.sverigeAdmin.request("/api/v2/function/provider-review", {
      method: "POST", body: { id: 1, decision: "approve" },
    });
    check(!res.ok, `site-admins should be refused, got ${res.status}`);
  });

  await step("a sverige.jp site admin gets no admin page", async () => {
    await users.sverigeAdmin.page.goto("/admin");
    await expect(users.sverigeAdmin.page.getByText("Du har inte behörighet till den här sidan.")).toBeVisible();
  });

  await step("an ordinary member is refused by the review function", async () => {
    const res = await users.member.request("/api/v2/function/provider-review", {
      method: "POST", body: { id: 1, decision: "approve" },
    });
    check(!res.ok, `member should be refused, got ${res.status}`);
  });
});

scenario("provider registration requires sign-in and a valid VAT number", {
  setup: { users: { applicant: { name: "Anna Sökande" }, visitor: "anonymous" } },
}, async ({ users }) => {
  await step("a signed-out visitor is sent to sign in", async () => {
    await users.visitor.page.goto("/bli-utforare");
    await expect(users.visitor.page.getByRole("heading", { name: "Välkommen" })).toBeVisible();
  });

  await step("a signed-in member sees the registration form", async () => {
    await users.applicant.page.goto("/bli-utforare");
    await expect(users.applicant.page.getByRole("heading", { name: "Bli utförare" })).toBeVisible();
    await expect(users.applicant.page.getByLabel("Momsregistreringsnummer")).toBeVisible();
  });

  await step("the server refuses a VAT number with a bad checksum", async () => {
    const res = await users.applicant.request("/api/v2/function/provider-apply", {
      method: "POST",
      body: {
        contact_name: "Anna", company_name: "Annas Städ", vat_number: "SE556012579101", category: "Städning",
        city: "Lund", phone: "070-1", photo_path: `/content/provider-photos/${users.applicant.uuid}/x.jpg`,
      },
    });
    check(res.status === 400, `expected 400, got ${res.status}`);
    check(res.json<{ error: string }>().error.includes("Momsregistreringsnumret är ogiltigt"), "wrong error text");
  });
});

scenario("listing photos show on the home page; only the owner can edit a listing", {
  setup: {
    users: { member: { name: "Vanlig Medlem" }, visitor: "anonymous" },
    files: {
      "/provider-public/seed-provider/face.jpg": { text: "placeholder", type: "image/jpeg" },
      "/provider-public/seed-provider/van.jpg": { text: "placeholder", type: "image/jpeg" },
    },
    database: [{
      table: "providers",
      rows: [{
        name: "Gröna Händer", category: "Trädgård", city: "Malmö", description: "Gräsklippning", price_from: 350,
        rating: 0, reviews: 0, rut: 1, user_uuid: "seed-provider",
        avatar_path: "/content/provider-public/seed-provider/face.jpg", cover_path: "/content/provider-public/seed-provider/van.jpg",
      }],
    }],
  },
}, async ({ users }) => {
  await step("a visitor sees the face photo and the cover image on the listing", async () => {
    const card = users.visitor.page.getByRole("article").filter({ hasText: "Gröna Händer" });
    await users.visitor.page.goto("/");
    await expect(card.getByRole("img", { name: "Foto på Gröna Händer" })).toBeVisible();
    await expect(card.getByRole("img", { name: "Bild från Gröna Händer" })).toBeVisible();
  });

  await step("a member without a provider profile cannot edit someone else's listing", async () => {
    const res = await users.member.request("/api/v2/function/provider-profile", {
      method: "POST",
      body: { action: "listing", listing_id: 1, name: "Kapad", category: "Trädgård", city: "Malmö" },
    });
    check(res.status === 404, `expected 404, got ${res.status}`);
    await users.visitor.page.goto("/");
    await expect(users.visitor.page.getByRole("heading", { name: "Gröna Händer" })).toBeVisible();
    await expect(users.visitor.page.getByRole("heading", { name: "Kapad" })).not.toBeVisible();
  });

  await step("a member who is not a provider sees no provider section on their profile", async () => {
    await users.member.page.goto("/account/profile");
    await expect(users.member.page.getByRole("heading", { name: "Profil", exact: true })).toBeVisible();
    await expect(users.member.page.getByRole("heading", { name: "Utförarprofil" })).not.toBeVisible();
  });
});

scenario("uploaded photos stay hidden until an admin approves them, and can be rejected", {
  setup: {
    users: {
      admin: { name: "Admin Ann", groups: ["seniorportalen-admins"] },
      member: { name: "Vanlig Medlem" },
      visitor: "anonymous",
    },
    files: {
      "/provider-photos/seed-provider/new-face.jpg": { text: "placeholder", type: "image/jpeg" },
      "/provider-photos/seed-provider/odd.jpg": { text: "placeholder", type: "image/jpeg" },
    },
    database: [
      {
        table: "provider_applications",
        rows: [{
          user_uuid: "seed-provider", contact_name: "Anna Olsson", company_name: "Gröna Händer", vat_number: "SE556012579001",
          vat_status: "verified", category: "Trädgård", city: "Malmö", rut: 1, phone: "070-1",
          photo_path: "", status: "approved",
        }],
      },
      {
        table: "providers",
        rows: [{
          name: "Gröna Händer", category: "Trädgård", city: "Malmö", description: "Gräsklippning", price_from: 350,
          rating: 0, reviews: 0, rut: 1, user_uuid: "seed-provider",
        }],
      },
      {
        table: "image_reviews",
        rows: [
          { user_uuid: "seed-provider", kind: "avatar", path: "/content/provider-photos/seed-provider/new-face.jpg", status: "pending" },
          { user_uuid: "seed-provider", kind: "cover", provider_id: 1, path: "/content/provider-photos/seed-provider/odd.jpg", status: "pending" },
        ],
      },
    ],
  },
}, async ({ users }) => {
  const card = () => users.visitor.page.getByRole("article").filter({ hasText: "Gröna Händer" });

  await step("pending photos are not shown on the home page", async () => {
    await users.visitor.page.goto("/");
    await expect(users.visitor.page.getByRole("heading", { name: "Gröna Händer" })).toBeVisible();
    await expect(card().getByRole("img", { name: "Foto på Gröna Händer" })).not.toBeVisible();
    await expect(card().getByRole("img", { name: "Bild från Gröna Händer" })).not.toBeVisible();
  });

  await step("an ordinary member cannot approve a photo", async () => {
    const res = await users.member.request("/api/v2/function/image-review", {
      method: "POST", body: { action: "decide", id: 1, decision: "approve" },
    });
    check(!res.ok, `member should be refused, got ${res.status}`);
  });

  await step("the admin rejects the unsuitable cover image", async () => {
    const p = users.admin.page;
    await p.goto("/admin");
    await p.getByRole("tab", { name: /Bilder att granska/ }).click();
    const item = p.getByRole("listitem").filter({ hasText: "Ny bild för annonsen" });
    await item.getByPlaceholder("Kommentar till utföraren").fill("Bilden passar inte");
    await item.getByRole("button", { name: "Avslå och ta bort" }).click();
    await expect(p.getByText("Bilden är avslagen och borttagen.")).toBeVisible();
  });

  await step("the admin approves the new profile photo", async () => {
    const p = users.admin.page;
    await p.getByRole("listitem").filter({ hasText: "Ny profilbild" }).getByRole("button", { name: "Godkänn och publicera" }).click();
    await expect(p.getByText("Bilden är godkänd och publicerad.")).toBeVisible();
    await expect(p.getByText("Inga bilder att granska.")).toBeVisible();
  });

  await step("only the approved photo is now on the home page", async () => {
    await users.visitor.page.goto("/");
    await expect(card().getByRole("img", { name: "Foto på Gröna Händer" })).toBeVisible();
    await expect(card().getByRole("img", { name: "Bild från Gröna Händer" })).not.toBeVisible();
  });

  await step("the admin can take a provider's profile photo down again", async () => {
    const p = users.admin.page;
    await p.getByRole("tab", { name: "Utförare" }).click();
    await p.getByRole("listitem").filter({ hasText: "Gröna Händer" }).getByRole("button", { name: "Redigera" }).click();
    await p.getByRole("dialog").getByRole("button", { name: "Ta bort bilden" }).first().click();
    await p.getByRole("button", { name: "Spara" }).click();
    await expect(p.getByText("Sparat.")).toBeVisible();
    await users.visitor.page.goto("/");
    await expect(users.visitor.page.getByRole("heading", { name: "Gröna Händer" })).toBeVisible();
    await expect(card().getByRole("img", { name: "Foto på Gröna Händer" })).not.toBeVisible();
  });
});
