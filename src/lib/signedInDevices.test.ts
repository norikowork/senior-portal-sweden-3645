import { describe, expect, it } from "vitest";

import { UNKNOWN_LOCATION, countryName, lastActiveLabel } from "./signedInDevices";

describe("countryName", () => {
  it("names a country from its two-letter code", () => {
    expect(countryName("SE", "en")).toBe("Sweden");
    expect(countryName("JP", "en")).toBe("Japan");
  });

  it("names the country in the reader's language", () => {
    expect(countryName("SE", "sv")).toBe("Sverige");
  });

  it("calls a missing country an unknown location", () => {
    expect(countryName(null, "en")).toBe(UNKNOWN_LOCATION);
    expect(countryName(undefined, "en")).toBe(UNKNOWN_LOCATION);
    expect(countryName("", "en")).toBe(UNKNOWN_LOCATION);
  });

  it("calls anything that is not an uppercase two-letter code an unknown location", () => {
    expect(countryName("se", "en")).toBe(UNKNOWN_LOCATION);
    expect(countryName("SWE", "en")).toBe(UNKNOWN_LOCATION);
    expect(countryName("1A", "en")).toBe(UNKNOWN_LOCATION);
  });
});

describe("lastActiveLabel", () => {
  it("formats epoch seconds, not milliseconds", () => {
    const seconds = Date.UTC(2026, 9, 24, 12, 0) / 1000;
    expect(lastActiveLabel(seconds, "en-US")).toContain("2026");
    expect(lastActiveLabel(seconds, "en-US")).toBe(
      new Date(seconds * 1000).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }),
    );
  });
});
