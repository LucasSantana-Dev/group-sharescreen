"use client";

import { useEffect } from "react";
import { getSignalingHttpBase } from "@/lib/roomsApi";
import { translate } from "@/lib/i18n";

// Reports this copy of the site to the original on every load: domain, name,
// people online on its own API, build. The URL is hardcoded on purpose — a
// fork must report to golive.nemtudo.me, not to itself. Viewed only in
// sharescreen-admin (see /admin/site-beacons on the API).
const BEACON_URL = "https://golive.nemtudo.me/api/site-beacon";

// Once per browser session (sessionStorage), and never more often than once a
// minute across tabs (localStorage), so reloads and new tabs don't spam it.
const SESSION_KEY = "sharescreen:siteBeaconSent";
const LAST_SENT_KEY = "sharescreen:siteBeaconLastSent";
const MIN_INTERVAL_MS = 60_000;

function shouldSend(): boolean {
  try {
    if (sessionStorage.getItem(SESSION_KEY)) return false;
    const last = Number(localStorage.getItem(LAST_SENT_KEY)) || 0;
    if (Date.now() - last < MIN_INTERVAL_MS) return false;
    sessionStorage.setItem(SESSION_KEY, "1");
    localStorage.setItem(LAST_SENT_KEY, String(Date.now()));
    return true;
  } catch {
    return false;
  }
}

export function SiteBeacon({ isOriginal }: { isOriginal: boolean }) {
  useEffect(() => {
    if (!shouldSend()) return;
    const apiBase = getSignalingHttpBase();
    (async () => {
      let peopleOnline: number | null = null;
      try {
        const res = await fetch(`${apiBase}/stats`, { signal: AbortSignal.timeout(5000) });
        if (res.ok) peopleOnline = Number((await res.json())?.peopleOnline) || 0;
      } catch {}
      // Already marked as sent in shouldSend; finish the report even if the
      // component unmounted (e.g. Strict Mode remount).
      const payload = JSON.stringify({
        domain: window.location.hostname,
        url: window.location.href,
        siteName: document.title || translate("common.golive"),
        apiBase,
        peopleOnline,
        commit: process.env.NEXT_PUBLIC_BUILD_COMMIT ?? "",
        isOriginal,
      });
      try {
        if (!navigator.sendBeacon?.(BEACON_URL, new Blob([payload], { type: "text/plain" }))) {
          void fetch(BEACON_URL, { method: "POST", body: payload, keepalive: true, mode: "no-cors" }).catch(() => {});
        }
      } catch {}
    })();
  }, [isOriginal]);
  return null;
}
