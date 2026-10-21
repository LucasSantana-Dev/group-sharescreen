"use client";

import { useState } from "react";
import { FaDiscord } from "react-icons/fa";
import { MdOutlineAdsClick, MdOutlinePeopleAlt, MdOutlineRemoveRedEye, MdCheck } from "react-icons/md";
import { CustomizerPreview } from "@/components/PartnerAdCustomizer";
import { useT } from "@/lib/useI18n";
import { useVideoDurationLabel } from "@/lib/useVideoDuration";
import {
  PARTNER_DISCORD_URL,
  SELF_SERVE_PARTNER_EVENTS,
  STATUS_TONE_CLASS,
  orderStatusDisplay,
  packageDurationLabel,
  pricePerDayCents,
  trackPartnerOrderEvent,
  type PartnerCreative,
  type PartnerOrder,
  type PartnerPackage,
} from "@/lib/partnerOrders";

// The pieces the self-serve ad pages share: the audience numbers, the Discord
// way out, the duration picker, the card preview and the status pill.

/** The three numbers an advertiser asks first. Averages, stated as such. */
export function PartnerAudienceStats({ compact = false }: { compact?: boolean }) {
  const t = useT();
  const items = [
    { Icon: MdOutlineRemoveRedEye, value: t("partnerOrders.audience.impressionsValue"), label: t("partnerOrders.audience.impressionsLabel") },
    { Icon: MdOutlinePeopleAlt, value: t("partnerOrders.audience.peopleValue"), label: t("partnerOrders.audience.peopleLabel") },
    { Icon: MdOutlineAdsClick, value: t("partnerOrders.audience.clicksValue"), label: t("partnerOrders.audience.clicksLabel") },
  ];
  return (
    <section>
      {!compact && (
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {t("partnerOrders.audience.title")}
        </p>
      )}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {items.map(({ Icon, value, label }) => (
          <div
            key={label}
            className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-lg font-bold leading-tight tabular-nums text-zinc-950 dark:text-zinc-50">{value}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">{t("partnerOrders.audience.footnote")}</p>
    </section>
  );
}

/** "Quer saber mais, negociar ou falar com alguém? Abra um ticket" — always in sight. */
export function PartnerDiscordBanner({
  source,
  stacked = false,
}: {
  source: string;
  /** Always one column — for narrow spots like a sidebar, where a row squeezes the text. */
  stacked?: boolean;
}) {
  const t = useT();
  return (
    <a
      href={PARTNER_DISCORD_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackPartnerOrderEvent(SELF_SERVE_PARTNER_EVENTS.discordClick)}
      data-source={source}
      className={`flex flex-col gap-3 rounded-xl bg-[#5865f2] p-4 text-white transition hover:opacity-95 ${
        stacked ? "" : "sm:flex-row sm:items-center"
      }`}
    >
      <FaDiscord className="h-8 w-8 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{t("partnerOrders.discord.title")}</p>
        <p className="text-sm text-white/85">{t("partnerOrders.discord.text")}</p>
      </div>
      <span className="shrink-0 rounded-lg bg-white px-3 py-2 text-center text-sm font-semibold text-[#5865f2]">
        {t("partnerOrders.discord.cta")}
      </span>
    </a>
  );
}

/** The durations on sale, as cards. The cheapest per day gets marked. */
export function PartnerPackagePicker({
  packages,
  value,
  onChange,
}: {
  packages: PartnerPackage[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  const t = useT();
  const basePerDay = packages.length ? pricePerDayCents(packages[0]) : 0;
  const bestId = packages.reduce<PartnerPackage | null>(
    (best, pkg) => (!best || pricePerDayCents(pkg) < pricePerDayCents(best) ? pkg : best),
    null
  )?.id;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {packages.map((pkg) => {
        const selected = pkg.id === value;
        const perDay = pricePerDayCents(pkg);
        const saving = basePerDay > 0 ? Math.round((1 - perDay / basePerDay) * 100) : 0;
        return (
          <button
            key={pkg.id}
            type="button"
            onClick={() => onChange(pkg.id)}
            aria-pressed={selected}
            className={`relative flex flex-col items-start rounded-xl border p-3 text-left transition ${
              selected
                ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/30 dark:bg-emerald-950/30"
                : "border-zinc-200 bg-white hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600"
            }`}
          >
            {pkg.id === bestId && (
              <span className="absolute -top-2 right-2 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                {t("partnerOrders.packages.bestValue")}
              </span>
            )}
            <span className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">{packageDurationLabel(pkg.hours)}</span>
            <span className="mt-1 text-lg font-bold tabular-nums text-zinc-950 dark:text-zinc-50">{pkg.priceLabel}</span>
            <span className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
              {saving > 0 ? t("partnerOrders.packages.saving", { percent: saving }) : t("partnerOrders.packages.base")}
            </span>
            {selected && <MdCheck className="absolute bottom-2 right-2 h-5 w-5 text-emerald-600" />}
          </button>
        );
      })}
      <a
        href={PARTNER_DISCORD_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackPartnerOrderEvent(SELF_SERVE_PARTNER_EVENTS.discordClick)}
        className="flex flex-col items-start justify-center rounded-xl border border-dashed border-[#5865f2]/60 p-3 text-left transition hover:bg-[#5865f2]/10"
      >
        <span className="text-sm font-semibold text-[#5865f2]">{t("partnerOrders.packages.moreDays")}</span>
        <span className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">{t("partnerOrders.packages.moreDaysHint")}</span>
      </a>
    </div>
  );
}

/** The card as visitors will see it, in both of the shapes it is served in. */
export function PartnerPreviewPanel({ creative }: { creative: PartnerCreative }) {
  const t = useT();
  const [horizontal, setHorizontal] = useState(false);
  const rewardDuration = useVideoDurationLabel(creative.rewardVideoUrl && creative.rewardPoints ? creative.rewardVideoUrl : null);
  const segment = (active: boolean) =>
    `flex-1 rounded-md px-2 py-1 text-xs font-semibold transition ${
      active
        ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-50"
        : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
    }`;
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{t("partnerAdCustomizer.preview")}</p>
        <div className="flex w-44 gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-900">
          <button type="button" onClick={() => setHorizontal(false)} className={segment(!horizontal)}>
            {t("partnerAdCustomizer.layoutVertical")}
          </button>
          <button type="button" onClick={() => setHorizontal(true)} className={segment(horizontal)}>
            {t("partnerAdCustomizer.layoutHorizontal")}
          </button>
        </div>
      </div>
      <CustomizerPreview
        creative={{
          title: creative.title,
          description: creative.description,
          imageUrl: creative.imageUrl,
          iconUrl: creative.iconUrl,
          buttonLabel: creative.buttonLabel,
          buttonUrl: creative.buttonUrl,
          backgroundColor: creative.backgroundColor,
          textColor: creative.textColor,
          buttonBackgroundColor: creative.buttonBackgroundColor,
          buttonTextColor: creative.buttonTextColor,
        }}
        horizontal={horizontal}
        rewardPoints={creative.rewardVideoUrl && creative.rewardPoints ? String(creative.rewardPoints) : ""}
        rewardDuration={rewardDuration}
        clickPoints={
          creative.clickRewardPoints && creative.clickRewardPlacement !== "video" ? String(creative.clickRewardPoints) : ""
        }
      />
    </div>
  );
}

export function PartnerStatusPill({ order }: { order: Pick<PartnerOrder, "status" | "live" | "pendingCreative"> }) {
  const { label, tone } = orderStatusDisplay(order);
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_TONE_CLASS[tone]}`}>
      {tone === "emerald" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />}
      {label}
    </span>
  );
}
