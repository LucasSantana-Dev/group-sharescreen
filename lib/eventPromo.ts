// The "acontecendo agora" corner card — mirrors server/eventPromoStore.ts's
// EventPromo exactly. Shared by the card on every page
// (components/EventPromoWidget.tsx) and the admin panel that writes it
// (app/admin/EventPromosPanel.tsx).

export type EventPromoTheme = "red" | "purple" | "blue" | "green" | "orange" | "pink";
export type EventPromoPosition = "bottom-left" | "bottom-right";
export type EventPromoInRoom = "expanded" | "minimized" | "hidden";

export type EventPromo = {
  id: string;
  version: number;
  enabled: boolean;
  badge: string;
  title: string;
  description: string;
  buttonLabel: string;
  url: string;
  newTab: boolean;
  imageUrl: string | null;
  theme: EventPromoTheme;
  startsAt: number | null;
  endsAt: number | null;
  showBeforeStart: boolean;
  position: EventPromoPosition;
  inRoom: EventPromoInRoom;
  dismissible: boolean;
  priority: number;
  createdAt: number;
  updatedAt: number;
};

export type EventPromoInput = Omit<EventPromo, "id" | "version" | "createdAt" | "updatedAt">;

export const EVENT_PROMO_THEMES: EventPromoTheme[] = ["red", "purple", "blue", "green", "orange", "pink"];

// Tailwind classes per theme. Spelled out in full so the compiler sees them.
export const EVENT_PROMO_THEME_CLASSES: Record<
  EventPromoTheme,
  { gradient: string; ring: string; button: string; dot: string; glow: string; swatch: string }
> = {
  red: {
    gradient: "from-rose-600 via-red-600 to-orange-500",
    ring: "ring-rose-400/60",
    button: "bg-white text-rose-700 hover:bg-rose-50",
    dot: "bg-white",
    glow: "shadow-rose-600/40",
    swatch: "bg-rose-600",
  },
  purple: {
    gradient: "from-fuchsia-600 via-purple-600 to-indigo-600",
    ring: "ring-fuchsia-400/60",
    button: "bg-white text-purple-700 hover:bg-purple-50",
    dot: "bg-white",
    glow: "shadow-purple-600/40",
    swatch: "bg-purple-600",
  },
  blue: {
    gradient: "from-sky-500 via-blue-600 to-indigo-600",
    ring: "ring-sky-400/60",
    button: "bg-white text-blue-700 hover:bg-blue-50",
    dot: "bg-white",
    glow: "shadow-blue-600/40",
    swatch: "bg-blue-600",
  },
  green: {
    gradient: "from-emerald-500 via-green-600 to-teal-600",
    ring: "ring-emerald-400/60",
    button: "bg-white text-emerald-700 hover:bg-emerald-50",
    dot: "bg-white",
    glow: "shadow-emerald-600/40",
    swatch: "bg-emerald-600",
  },
  orange: {
    gradient: "from-amber-500 via-orange-500 to-red-500",
    ring: "ring-amber-400/60",
    button: "bg-white text-orange-700 hover:bg-orange-50",
    dot: "bg-white",
    glow: "shadow-orange-600/40",
    swatch: "bg-orange-500",
  },
  pink: {
    gradient: "from-pink-500 via-rose-500 to-fuchsia-600",
    ring: "ring-pink-400/60",
    button: "bg-white text-pink-700 hover:bg-pink-50",
    dot: "bg-white",
    glow: "shadow-pink-600/40",
    swatch: "bg-pink-500",
  },
};

export type EventPromoPhase = "upcoming" | "live" | "ended";

export function eventPromoPhase(promo: Pick<EventPromo, "startsAt" | "endsAt">, now: number): EventPromoPhase {
  if (promo.endsAt !== null && now >= promo.endsAt) return "ended";
  if (promo.startsAt !== null && now < promo.startsAt) return "upcoming";
  return "live";
}

/** Whether the card shows at all right now, from the visitor's clock. */
export function eventPromoVisibleAt(promo: EventPromo, now: number): boolean {
  const phase = eventPromoPhase(promo, now);
  if (phase === "ended") return false;
  if (phase === "upcoming") return promo.showBeforeStart;
  return true;
}

/** "2d 4h", "3h 12min", "4:05" — the countdown before an event starts. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}min`;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Per-browser state: which cards were minimized or closed. Keyed by id, not
// version, so an edit from the admin updates the card in place without
// re-opening one somebody already put away.

const STORAGE_KEY = "sharescreen:eventPromo";

type StoredState = { minimized: string[]; dismissed: string[] };

export function readEventPromoState(): StoredState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return {
      minimized: Array.isArray(parsed?.minimized) ? parsed.minimized : [],
      dismissed: Array.isArray(parsed?.dismissed) ? parsed.dismissed : [],
    };
  } catch {
    return { minimized: [], dismissed: [] };
  }
}

export function writeEventPromoState(state: StoredState) {
  try {
    // Capped so ids of long-gone promos cannot pile up forever.
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ minimized: state.minimized.slice(-50), dismissed: state.dismissed.slice(-50) })
    );
  } catch {
    // Private mode / blocked storage: the state just lasts for this page.
  }
}

/** True when the promo links to the page the visitor is already on. */
export function eventPromoPointsHere(url: string, pathname: string | null): boolean {
  if (!pathname || !url.startsWith("/")) return false;
  const target = url.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  const here = pathname.replace(/\/+$/, "") || "/";
  return target !== "/" && here === target;
}
