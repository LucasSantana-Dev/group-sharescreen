// Receives SiteBeacon reports from every copy of the site (the original and
// any fork — they all post to golive.nemtudo.me, hardcoded) and forwards them
// to the API, which stores them for the admin panel.
//
// Sent with navigator.sendBeacon as text/plain, so a fork's cross-origin post
// needs no CORS preflight; the headers below cover a plain fetch too.
const API_BASE = (process.env.NEXT_PUBLIC_SIGNALING_URL || "ws://localhost:4000/ws")
  .replace(/^ws/, "http")
  .replace(/\/ws\/?$/, "");

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(request: Request) {
  const body = (await request.text()).slice(0, 4000);
  try {
    await fetch(`${API_BASE}/site-beacon`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": request.headers.get("user-agent") ?? "",
        "x-forwarded-for": request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for") ?? "",
      },
      body,
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // A lost report is fine; never fail the caller over it.
  }
  return new Response(null, { status: 204, headers: CORS });
}
