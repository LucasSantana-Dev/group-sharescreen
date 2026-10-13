"use client";

import { useEffect } from "react";
import { MdClose } from "react-icons/md";
import { VerifiedBadgeIcon } from "./icons";
import { useT } from "@/lib/useI18n";
import { useOpenPro } from "@/lib/proModal";
import { trackFeatureEvent, useFeature } from "@/lib/features";
import { dismissTurnUpsell, useTurnUpsell } from "@/lib/turnUpsell";

// "A transmissão está ruim ou não carrega? Assine o Pro": shown when a stream
// never connected and this account has no TURN (see lib/turnUpsell). Behind
// the experiment below so the notice itself can be measured.
export const TURN_UPSELL_FEATURE = "pro-turn-notice";
export const TURN_UPSELL_EVENTS = {
  shown: "turn_upsell_shown",
  click: "turn_upsell_click",
  dismiss: "turn_upsell_dismiss",
} as const;

export default function TurnUpsellNotice() {
  const t = useT();
  const openPro = useOpenPro();
  const needed = useTurnUpsell();
  const feature = useFeature(TURN_UPSELL_FEATURE, { track: needed });
  const visible = needed && feature.enabled;

  useEffect(() => {
    if (visible) trackFeatureEvent(TURN_UPSELL_EVENTS.shown, { feature: TURN_UPSELL_FEATURE });
  }, [visible]);

  if (!visible) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-start gap-3 rounded-xl bg-blue-600 px-4 py-3 text-sm text-white shadow-lg"
    >
      <VerifiedBadgeIcon className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="flex-1">
        <p className="font-medium">{t("turnUpsell.title")}</p>
        <p className="mt-0.5 text-white/85">{t("turnUpsell.body")}</p>
        <button
          type="button"
          onClick={() => {
            trackFeatureEvent(TURN_UPSELL_EVENTS.click, { feature: TURN_UPSELL_FEATURE });
            openPro();
          }}
          className="mt-2 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
        >
          {t("turnUpsell.cta")}
        </button>
      </div>
      <button
        type="button"
        onClick={() => {
          trackFeatureEvent(TURN_UPSELL_EVENTS.dismiss, { feature: TURN_UPSELL_FEATURE });
          dismissTurnUpsell();
        }}
        aria-label={t("turnUpsell.dismiss")}
        className="-m-1 rounded p-1 text-white/80 hover:text-white"
      >
        <MdClose className="h-5 w-5" />
      </button>
    </div>
  );
}
