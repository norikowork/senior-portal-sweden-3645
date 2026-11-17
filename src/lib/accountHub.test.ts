import { beforeEach, describe, expect, it } from "vitest";

import { accountCards, clearAccountCards, registerAccountCard } from "./accountHub";

describe("accountHub", () => {
  beforeEach(() => {
    clearAccountCards();
  });

  it("starts empty so an app with no contributing spine shows no extra cards", () => {
    expect(accountCards()).toEqual([]);
  });

  it("returns cards in order, breaking ties on key", () => {
    registerAccountCard({ key: "billing", to: "/account/billing", title: "Billing", description: "b" });
    registerAccountCard({ key: "orders", to: "/account/orders", title: "Orders", description: "o" });
    registerAccountCard({ key: "team", to: "/team", title: "Team", description: "t", order: 50 });

    expect(accountCards().map((card) => card.key)).toEqual(["team", "billing", "orders"]);
  });

  it("replaces a card registered twice under one key rather than duplicating it", () => {
    registerAccountCard({ key: "orders", to: "/account/orders", title: "Orders", description: "first" });
    registerAccountCard({ key: "orders", to: "/account/orders", title: "Orders", description: "second" });

    expect(accountCards()).toHaveLength(1);
    expect(accountCards()[0].description).toBe("second");
  });

  it("refuses a card with no key, because a keyless card can never be replaced", () => {
    expect(() =>
      registerAccountCard({ key: "", to: "/account/orders", title: "Orders", description: "o" }),
    ).toThrow(/stable key/);
  });

  it("refuses an external destination, because the account page links in-app only", () => {
    expect(() =>
      registerAccountCard({
        key: "orders",
        to: "https://example.com/orders",
        title: "Orders",
        description: "o",
      }),
    ).toThrow(/in-app path/);
  });
});
