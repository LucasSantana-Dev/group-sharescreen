"use client";

import { Capacitor, registerPlugin } from "@capacitor/core";
import { isMobileApp } from "./desktop";
import { trackFeatureEvent } from "./features";
import { wasTurnUpsellRaised } from "./turnUpsell";

// Google Play's "avalie o app" sheet, inside the Android app. The native half
// is android/…/InAppReviewPlugin.java.
//
// When to ask is borrowed from the apps that do it well (Duolingo, Spotify,
// Telegram): right *after* something went well, never in the middle of it,
// and only to people who already came back on their own. Here that means
// leaving a call that lasted a while and had no connection trouble — not at
// launch, not during a call, not to someone on their first day.
//
// Play keeps its own quota and may silently show nothing; the limits below
// keep us from spending that quota on the wrong moments. Play's rules also
// forbid asking for a specific rating or asking first "você gosta do app?",
// so the sheet is shown as is, with no text of ours around it.

export const APP_REVIEW_FEATURE = "android-review-prompt";
export const APP_REVIEW_EVENTS = {
  requested: "app_review_requested",
  unavailable: "app_review_unavailable",
} as const;

const DAY_MS = 24 * 3600 * 1000;
// Installed (first seen) at least this long ago.
const MIN_AGE_MS = 3 * DAY_MS;
// Opened on at least this many different days.
const MIN_ACTIVE_DAYS = 3;
// The call being left lasted at least this long.
export const MIN_CALL_MS = 5 * 60 * 1000;
// Between two asks, and how many ever.
const COOLDOWN_MS = 120 * DAY_MS;
const MAX_ASKS = 3;

const STATE_KEY = "sharescreen:appReview";

interface ReviewState {
  firstSeen: number;
  days: string[];
  lastAsked: number | null;
  asks: number;
}

interface InAppReviewPlugin {
  request(): Promise<void>;
}

const InAppReview = registerPlugin<InAppReviewPlugin>("InAppReview");

function readState(): ReviewState {
  try {
    const raw = JSON.parse(localStorage.getItem(STATE_KEY) || "null");
    if (raw && typeof raw.firstSeen === "number" && Array.isArray(raw.days)) {
      return {
        firstSeen: raw.firstSeen,
        days: raw.days.filter((d: unknown) => typeof d === "string").slice(-30),
        lastAsked: typeof raw.lastAsked === "number" ? raw.lastAsked : null,
        asks: typeof raw.asks === "number" ? raw.asks : 0,
      };
    }
  } catch {
    // Storage blocked or garbage: start over.
  }
  return { firstSeen: Date.now(), days: [], lastAsked: null, asks: 0 };
}

function writeState(state: ReviewState) {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    // Without storage it simply never qualifies.
  }
}

function available(): boolean {
  return isMobileApp() && Capacitor.isPluginAvailable("InAppReview");
}

/** Counts today as a day the app was used. Called once per app start. */
export function noteAppOpen() {
  if (!isMobileApp()) return;
  const state = readState();
  const today = new Date().toISOString().slice(0, 10);
  if (!state.days.includes(today)) state.days.push(today);
  writeState(state);
}

/**
 * The person just left a call of `callMs`. Asks for the review if this is a
 * good moment (see the top of this file) and `enabled` (the experiment).
 */
export function maybeRequestAppReview(callMs: number, enabled: boolean) {
  if (!enabled || !available()) return;
  if (callMs < MIN_CALL_MS || wasTurnUpsellRaised()) return;
  const state = readState();
  const now = Date.now();
  if (now - state.firstSeen < MIN_AGE_MS) return;
  if (state.days.length < MIN_ACTIVE_DAYS) return;
  if (state.asks >= MAX_ASKS) return;
  if (state.lastAsked !== null && now - state.lastAsked < COOLDOWN_MS) return;
  writeState({ ...state, lastAsked: now, asks: state.asks + 1 });
  InAppReview.request().then(
    () => trackFeatureEvent(APP_REVIEW_EVENTS.requested, { feature: APP_REVIEW_FEATURE }),
    () => trackFeatureEvent(APP_REVIEW_EVENTS.unavailable, { feature: APP_REVIEW_FEATURE })
  );
}
