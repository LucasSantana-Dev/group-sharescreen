// The Microsoft Store listing of the desktop app, and the experiment that
// sends the Windows download there instead of to the NSIS installer.

import { getLocale, LOCALE_TAGS } from "./i18n";

/** Feature key in the admin panel (target "user"). */
export const MS_STORE_FEATURE = "download-ms-store";

/** Site events: `ms_store_click` (Store link) vs `ms_store_exe_click` (installer, control group). */
export const MS_STORE_EVENTS = {
  storeClick: "ms_store_click",
  exeClick: "ms_store_exe_click",
} as const;

const PRODUCT_ID = "9N29JDBBLH3M";

/**
 * The listing in the visitor's language and country.
 *
 * `hl` is the site's own locale, so the Store page reads in the language the
 * person was just reading. `gl` (market: price, availability) comes from the
 * browser's region — the site locale says nothing about where someone is —
 * and is left out when the browser does not say, letting the Store use the
 * account's own market.
 */
export function msStoreUrl(): string {
  const params = new URLSearchParams({ hl: LOCALE_TAGS[getLocale()].toLowerCase() });
  const region = typeof navigator !== "undefined" ? regionOf(navigator.languages ?? [navigator.language]) : null;
  if (region) params.set("gl", region);
  return `https://apps.microsoft.com/detail/${PRODUCT_ID}?${params}`;
}

function regionOf(tags: readonly string[]): string | null {
  for (const tag of tags) {
    try {
      const region = new Intl.Locale(tag).region;
      if (region && /^[A-Z]{2}$/.test(region)) return region;
    } catch {
      // Malformed tag — try the next one.
    }
  }
  return null;
}
