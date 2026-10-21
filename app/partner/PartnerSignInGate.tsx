"use client";

import { useState } from "react";
import { AccountModal, type AccountModalMode } from "@/components/AccountModal";
import { PartnerAudienceStats, PartnerDiscordBanner } from "@/components/partnerOrders/PartnerOrderParts";
import { useT } from "@/lib/useI18n";

/** The ad dashboard belongs to an account: what someone signed out sees instead. */
export function PartnerSignInGate() {
  const t = useT();
  const [mode, setMode] = useState<AccountModalMode | null>(null);
  return (
    <main className="mx-auto flex w-full max-w-3xl grow flex-col gap-5 px-4 py-10">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
          {t("partnerPitch.eyebrow")}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-zinc-950 dark:text-zinc-50">{t("partnerOrders.gate.title")}</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500 dark:text-zinc-400">{t("partnerOrders.gate.text")}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => setMode("login")}
            className="rounded-xl bg-zinc-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            {t("common.signIn")}
          </button>
          <button
            type="button"
            onClick={() => setMode("create")}
            className="rounded-xl border border-zinc-300 px-5 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            {t("partnerOrders.gate.create")}
          </button>
        </div>
      </div>
      <PartnerAudienceStats />
      <PartnerDiscordBanner source="gate" />
      <AccountModal mode={mode} onModeChange={setMode} />
    </main>
  );
}
