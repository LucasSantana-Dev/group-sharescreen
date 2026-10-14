"use client";

import { useT } from "@/lib/useI18n";

// The notice a fork of GoLive carries: shown by app/layout.tsx unless the
// deployment sets THIS_IS_THE_ORIGINAL_SITE_DONT_CHANGE_THIS_OR_I_WILL_SUE_YOU=true.
export const ORIGINAL_SITE_URL = "https://golive.nemtudo.me";

export function ForkWatermark() {
  const t = useT();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[9999] flex justify-center px-4 pb-1">
      <p className="pointer-events-auto rounded-t-md bg-black/70 px-3 py-1 text-center text-[11px] text-white/90 backdrop-blur-sm">
        {t("forkWatermark.text")}{" "}
        <a href={ORIGINAL_SITE_URL} target="_blank" rel="noopener" className="font-semibold underline">
          {t("forkWatermark.link")}
        </a>
      </p>
    </div>
  );
}
