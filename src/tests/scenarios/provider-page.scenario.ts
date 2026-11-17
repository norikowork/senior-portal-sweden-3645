// The public provider detail page (/utforare/:id): reached from a home-page card, shows the
// provider's own details, links their other services, and lets a signed-in customer ask for help.

import { expect, scenario, step } from "kliv-scenario";

scenario("a visitor opens a provider's page from the home page and a customer asks for help there", {
  setup: {
    users: { customer: { name: "Greta Kund" }, visitor: "anonymous" },
    database: [{
      table: "providers",
      rows: [
        {
          name: "Gröna Händer", category: "Trädgård", city: "Malmö", description: "Gräsklippning och beskärning",
          price_from: 350, rating: 0, reviews: 0, rut: 1, user_uuid: "seed-provider",
          about: "Hej! Jag heter Anna och sköter trädgårdar i Malmö.",
          price_list: JSON.stringify([{ name: "Häckklippning", price: 450, unit: "/tim" }]),
          service_area: "Malmö och Lund", good_to_know: "Jag tar med egna redskap.",
          cancellation: "Kostnadsfri avbokning senast 24 timmar innan.",
        },
        {
          name: "Annas Städ", category: "Städning", city: "Malmö", description: "Hemstädning",
          price_from: 300, rating: 0, reviews: 0, rut: 1, user_uuid: "seed-provider",
        },
      ],
    }],
  },
}, async ({ users }) => {
  await step("clicking a listing on the home page opens its detail page", async () => {
    const p = users.visitor.page;
    await p.goto("/");
    await p.getByRole("link", { name: "Gröna Händer" }).click();
    await expect(p.getByRole("heading", { level: 1, name: "Gröna Händer" })).toBeVisible();
  });

  await step("the page shows the provider's own details", async () => {
    const p = users.visitor.page;
    await expect(p.getByText("Hej! Jag heter Anna och sköter trädgårdar i Malmö.")).toBeVisible();
    await expect(p.getByRole("rowheader", { name: "Häckklippning" })).toBeVisible();
    await expect(p.getByText("450 kr /tim")).toBeVisible();
    await expect(p.getByText("Malmö och Lund")).toBeVisible();
    await expect(p.getByText("Jag tar med egna redskap.")).toBeVisible();
    await expect(p.getByText("Kostnadsfri avbokning senast 24 timmar innan.")).toBeVisible();
    await expect(p.getByText("✓ Granskad av Seniorportalen")).toBeVisible();
  });

  await step("it links the same provider's other services", async () => {
    const p = users.visitor.page;
    await p.getByRole("link", { name: /Annas Städ/ }).click();
    await expect(p.getByRole("heading", { level: 1, name: "Annas Städ" })).toBeVisible();
  });

  await step("a signed-in customer sends a request from the detail page", async () => {
    const p = users.customer.page;
    await p.goto("/");
    await p.getByRole("link", { name: "Gröna Händer" }).click();
    // Desktop layout: the booking box sits in the side panel (phones get their own copies).
    await p.getByRole("complementary").getByRole("button", { name: "Be om hjälp" }).click();
    await p.getByPlaceholder("Telefonnummer").fill("070-999 88 77");
    await p.getByPlaceholder("Vad behöver du hjälp med?").fill("Beskära äppelträdet");
    await p.getByRole("button", { name: "Skicka förfrågan" }).click();
    await expect(p.getByText("Tack! Din förfrågan är skickad.")).toBeVisible();
    await p.goto("/mina-sidor");
    await expect(p.getByText("Beskära äppelträdet")).toBeVisible();
  });

  await step("a missing provider shows a clear message", async () => {
    await users.visitor.page.goto("/utforare/999");
    await expect(users.visitor.page.getByRole("heading", { name: "Utföraren hittades inte" })).toBeVisible();
  });
});
