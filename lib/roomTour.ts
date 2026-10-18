"use client";

import { useCallback, useSyncExternalStore } from "react";
import { trackFeatureEvent, useFeature } from "./features";

// O tutorial da sala para quem entra no GoLive pela primeira vez: um balão
// que passa por cada controle (microfone, tela, chat, ...) com "Pular
// tutorial" em todos os passos. Ver components/RoomTour.
//
// Atrás do experiment `room-onboarding-tour` (target "user"; precisa de
// "includeGuests", quase todo mundo novo é convidado). Quem já usava o GoLive
// antes nunca vê: o tour só fica "pendente" para um navegador que não tinha
// nada nosso no localStorage quando a primeira página carregou.

export const ROOM_TOUR_FEATURE = "room-onboarding-tour";

export const ROOM_TOUR_EVENTS = {
  start: "room_tour_start", // value: quantos passos este layout tem
  step: "room_tour_step", // value: número do passo que apareceu (1, 2, ...)
  skip: "room_tour_skip", // value: em que passo pulou
  complete: "room_tour_complete", // chegou ao fim e clicou em "Concluir"
} as const;

const STATE_KEY = "sharescreen:roomTour";
type TourState = "pending" | "done";

function read(): TourState | null {
  try {
    const value = window.localStorage.getItem(STATE_KEY);
    return value === "pending" || value === "done" ? value : null;
  } catch {
    return null;
  }
}

const listeners = new Set<() => void>();
function write(value: TourState) {
  try {
    window.localStorage.setItem(STATE_KEY, value);
  } catch {
    // Sem storage: o tour some nesta página e volta na próxima — melhor que
    // nunca deixar fechar.
  }
  cached = value;
  for (const listener of listeners) listener();
}

// Lido na avaliação do módulo, antes de qualquer coisa da página criar um
// deviceId ou guardar as features (ver o wasReturning de lib/clipsMode). Este
// módulo entra no carregamento de toda página (WatchRoom vem do RoomCallHost
// no layout), então quem chega pela home e só depois abre uma sala continua
// "pendente" — inclusive numa visita seguinte.
let cached: TourState | null = (() => {
  if (typeof window === "undefined") return null;
  const current = read();
  if (current) return current;
  let returning = false;
  try {
    returning =
      window.localStorage.getItem("sharescreen:deviceId") !== null ||
      window.localStorage.getItem("sharescreen:features") !== null;
  } catch {
    return null;
  }
  const initial: TourState = returning ? "done" : "pending";
  try {
    window.localStorage.setItem(STATE_KEY, initial);
  } catch {
    // Ver write.
  }
  return initial;
})();

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STATE_KEY) return;
    cached = read();
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * Se o tour deve aparecer agora. `track` conta a exposição só para quem ainda
 * está "pendente" — sem isso, todo visitante antigo entraria no denominador.
 */
export function useRoomTour() {
  const pending = useSyncExternalStore(subscribe, () => cached === "pending", () => false);
  const feature = useFeature(ROOM_TOUR_FEATURE, { track: pending });
  const finish = useCallback(() => write("done"), []);
  return {
    pending,
    ready: feature.ready,
    enabled: feature.enabled,
    /** Não volta mais — chamado ao pular, ao concluir, ou para o controle. */
    finish,
  };
}

export function trackRoomTour(name: string, value?: number) {
  trackFeatureEvent(name, { feature: ROOM_TOUR_FEATURE, ...(value ? { value } : {}) });
}
