import { useSyncExternalStore } from "react";
import { isTurnAllowed, subscribeIceServers } from "./iceConfig";

// "A transmissão não carrega? Assine o Pro": raised when a stream we are
// receiving never connects while this account has no TURN (entitlement
// "dedicated_turn"). Without a relay, a viewer behind a strict NAT simply
// cannot reach some broadcasters — that is the one case where the plan
// would have fixed it, so it is the one case worth saying so.
//
// Process-wide rather than per room: the receiving connections live deep in
// useRoomMedia's per-channel hooks, and the notice is one banner per page.

// How long a receiving connection may sit unconnected before it counts —
// longer than a normal ICE negotiation, shorter than a person gives up.
export const TURN_UPSELL_DELAY_MS = 15_000;

let shown = false;
// Whether it was ever raised on this page — a call that had trouble is not
// the moment to ask for a review (see lib/appReview).
let raised = false;
let dismissed = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

/** A receiving connection failed, or never connected, without TURN. */
export function reportUnreachablePeer() {
  if (shown || dismissed || isTurnAllowed()) return;
  shown = true;
  raised = true;
  emit();
}

export function wasTurnUpsellRaised(): boolean {
  return raised;
}

/** The person closed the notice: not again for this page. */
export function dismissTurnUpsell() {
  dismissed = true;
  shown = false;
  emit();
}

// Also told when the plan changes (setTurnAllowed), so subscribing hides it.
function subscribe(listener: () => void) {
  listeners.add(listener);
  const stopIce = subscribeIceServers(listener);
  return () => {
    listeners.delete(listener);
    stopIce();
  };
}

/** Whether the notice should be up right now. */
export function useTurnUpsell(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => shown && !isTurnAllowed(),
    () => false
  );
}
