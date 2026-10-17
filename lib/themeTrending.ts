"use client";

import { trackFeatureEvent, useFeature } from "./features";
import type { WorkshopSort } from "./roomThemes";

// The "Em alta" ordering of the theme workshop, behind an experiment.
//
// Whoever is in it gets a fourth sort — scored on the server from popularity,
// what happened lately, whether it is climbing and how new it is (see the
// API's themeTrending) — and it is where their grid starts. Everyone else
// keeps "Mais usados" first. Both sides send the same events, so what the
// admin compares is how often a visit to the shop ends in a theme put on,
// bought or liked.

export const THEME_TRENDING_FEATURE = "theme-trending";

export const THEME_TRENDING_EVENTS = {
  /** Chose "Em alta" by hand in the sort control. */
  pick: "theme_trending_pick",
  /** Put on (or set for the room/group) a theme found in the shop. */
  apply: "theme_shop_apply",
  buy: "theme_shop_buy",
  like: "theme_shop_like",
} as const;

export function trackThemeShopEvent(name: (typeof THEME_TRENDING_EVENTS)[keyof typeof THEME_TRENDING_EVENTS]) {
  trackFeatureEvent(name, { feature: THEME_TRENDING_FEATURE });
}

const BASE_SORTS: WorkshopSort[] = ["popular", "liked", "recent"];

export const WORKSHOP_SORT_LABELS: Record<WorkshopSort, string> = {
  trending: "workshop.workshopPanel.trending",
  popular: "workshop.workshopPanel.mostUsed",
  liked: "workshop.workshopPanel.mostLiked",
  recent: "workshop.workshopPanel.recent",
};

/**
 * The sorts on offer and the one a fresh grid starts on. `ready` is false
 * until the experiment is decided, so the grid does not load "Mais usados"
 * only to throw it away a moment later for "Em alta".
 *
 * `track` only where the sort control is actually on screen.
 */
export function useWorkshopSorts(track: boolean): {
  sorts: WorkshopSort[];
  defaultSort: WorkshopSort;
  ready: boolean;
} {
  const feature = useFeature(THEME_TRENDING_FEATURE, { track });
  if (!feature.enabled) return { sorts: BASE_SORTS, defaultSort: "popular", ready: feature.ready };
  return { sorts: ["trending", ...BASE_SORTS], defaultSort: "trending", ready: true };
}
