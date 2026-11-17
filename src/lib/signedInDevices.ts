export const UNKNOWN_LOCATION = "Okänd plats";

/** The site is Swedish: country names and dates default to Swedish unless a caller asks otherwise. */
export const DEFAULT_LOCALE = "sv-SE";

/** The country's name in the reader's language, from an ISO 3166-1 alpha-2 code. */
export function countryName(code: string | null | undefined, locale: string = DEFAULT_LOCALE): string {
  if (!code || !/^[A-Z]{2}$/.test(code)) return UNKNOWN_LOCATION;
  try {
    const name = new Intl.DisplayNames([locale], { type: "region" }).of(code);
    return name && name !== code ? name : code;
  } catch {
    return code;
  }
}

/** When a session was last active (seconds since the epoch), as a short local date and time. */
export function lastActiveLabel(seconds: number, locale: string = DEFAULT_LOCALE): string {
  return new Date(seconds * 1000).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
}
