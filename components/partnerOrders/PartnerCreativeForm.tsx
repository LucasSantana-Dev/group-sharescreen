"use client";

import { useRef, type ReactNode } from "react";
import { PartnerMediaDrop } from "@/app/admin/PartnerMediaDrop";
import { PartnerScheduleEditor } from "@/app/admin/PartnerScheduleEditor";
import type { PartnerClickRewardPlacement } from "@/lib/partner";
import { useT } from "@/lib/useI18n";
import { SELF_SERVE_REWARD_POINTS_MAX, type PartnerCreative } from "@/lib/partnerOrders";

// The ad's fields, as the advertiser edits them — the same ones the admin form
// has (see app/admin/PartnerAdsPanel.tsx) minus the house's own (weight,
// expiry), split in two so the wizard can give each a step of its own:
//
//   "card"   — what the card says and looks like. Required.
//   "extras" — rewards, the long description and dayparts. All optional.

// Mirrors the API's limits (signaling.ts's PARTNER_*_MAX_LEN).
const TITLE_MAX = 80;
const DESCRIPTION_MAX = 400;
const BUTTON_LABEL_MAX = 40;
const EXTENDED_DESCRIPTION_MAX = 20000;

const inputClass =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none focus:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";
const colorInputClass =
  "mt-1 h-10 w-full cursor-pointer rounded-lg border border-zinc-300 bg-white p-1 dark:border-zinc-700 dark:bg-zinc-900";
const labelClass = "text-xs font-medium text-zinc-700 dark:text-zinc-300";
const hintClass = "mt-1 text-[11px] text-zinc-500 dark:text-zinc-400";

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</p>
      {hint && <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{hint}</p>}
      <div className="mt-3 flex flex-col gap-3">{children}</div>
    </section>
  );
}

/** What is missing before the card can be sent, or null when nothing is. */
export function creativeProblem(creative: PartnerCreative, t: (key: string) => string): string | null {
  if (!creative.title.trim()) return t("partnerOrders.form.needTitle");
  if (!creative.description.trim()) return t("partnerOrders.form.needDescription");
  if (!creative.buttonLabel.trim()) return t("partnerOrders.form.needButtonLabel");
  if (!/^https?:\/\/[^\s.]+\.[^\s]+$/i.test(creative.buttonUrl.trim())) return t("partnerOrders.form.needButtonUrl");
  if (creative.rewardVideoUrl && !creative.rewardPoints) return t("partnerOrders.form.needRewardPoints");
  if ((creative.schedules ?? []).some((s) => s.startMinute === s.endMinute)) return t("partnerOrders.form.badSchedule");
  return null;
}

export function PartnerCreativeForm({
  value,
  onChange,
  section,
}: {
  value: PartnerCreative;
  onChange: (next: PartnerCreative) => void;
  section: "card" | "extras";
}) {
  const t = useT();
  const extendedCaretRef = useRef<number | null>(null);

  function set<K extends keyof PartnerCreative>(key: K, next: PartnerCreative[K]) {
    onChange({ ...value, [key]: next });
  }
  const text = (raw: string) => (raw.trim() ? raw : null);
  const points = (raw: string) => {
    const n = Math.floor(Number(raw));
    return raw.trim() && Number.isFinite(n) && n > 0 ? Math.min(n, SELF_SERVE_REWARD_POINTS_MAX) : null;
  };

  if (section === "card") {
    return (
      <div className="flex flex-col gap-4">
        <Section title={t("partnerOrders.form.textTitle")} hint={t("partnerOrders.form.textHint")}>
          <div>
            <label className={labelClass} htmlFor="po-title">{t("common.title")}</label>
            <input
              id="po-title"
              className={inputClass}
              maxLength={TITLE_MAX}
              value={value.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder={t("partnerCard.yourBrandHere")}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="po-description">{t("common.description")}</label>
            <textarea
              id="po-description"
              className={`${inputClass} resize-y`}
              rows={3}
              maxLength={DESCRIPTION_MAX}
              value={value.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder={t("partnerCard.writeAShortCatchyDescriptionOf")}
            />
            <p className={`${hintClass} flex justify-between`}>
              <span>{t("admin.partnerAdsPanel.lineBreaksAreKept")}</span>
              <span className="tabular-nums">{value.description.length}/{DESCRIPTION_MAX}</span>
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="po-button-label">{t("common.buttonText")}</label>
              <input
                id="po-button-label"
                className={inputClass}
                maxLength={BUTTON_LABEL_MAX}
                value={value.buttonLabel}
                onChange={(e) => set("buttonLabel", e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="po-button-url">{t("common.buttonLink")}</label>
              <input
                id="po-button-url"
                className={inputClass}
                value={value.buttonUrl}
                onChange={(e) => set("buttonUrl", e.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>
        </Section>

        <Section title={t("partnerOrders.form.imagesTitle")} hint={t("partnerOrders.form.imagesHint")}>
          <div>
            <label className={labelClass} htmlFor="po-image">{t("partnerOrders.form.banner")}</label>
            <input
              id="po-image"
              className={inputClass}
              value={value.imageUrl ?? ""}
              onChange={(e) => set("imageUrl", text(e.target.value))}
              placeholder="https://..."
            />
            <PartnerMediaDrop advertiser kind="image" onUploaded={(url) => set("imageUrl", url)} />
          </div>
          <div>
            <label className={labelClass} htmlFor="po-icon">{t("partnerOrders.form.icon")}</label>
            <input
              id="po-icon"
              className={inputClass}
              value={value.iconUrl ?? ""}
              onChange={(e) => set("iconUrl", text(e.target.value))}
              placeholder="https://..."
            />
            <p className={hintClass}>{t("partnerAdCustomizer.iconHint")}</p>
            <PartnerMediaDrop advertiser kind="image" onUploaded={(url) => set("iconUrl", url)} />
          </div>
        </Section>

        <Section title={t("partnerOrders.form.colorsTitle")}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(
              [
                ["backgroundColor", t("common.background"), "#111827"],
                ["textColor", t("common.text"), "#f4f4f5"],
                ["buttonBackgroundColor", t("common.button"), "#10b981"],
                ["buttonTextColor", t("partnerAdCustomizer.buttonText"), "#ffffff"],
              ] as const
            ).map(([key, label, fallback]) => (
              <div key={key}>
                <label className={labelClass} htmlFor={`po-${key}`}>{label}</label>
                <input
                  id={`po-${key}`}
                  type="color"
                  className={colorInputClass}
                  value={value[key] ?? fallback}
                  onChange={(e) => set(key, e.target.value)}
                />
              </div>
            ))}
          </div>
        </Section>
      </div>
    );
  }

  // --- extras ---
  function insertExtendedImage(url: string) {
    const current = value.extendedDescription ?? "";
    const caret = extendedCaretRef.current;
    const at = caret === null ? current.length : Math.min(caret, current.length);
    const before = current.slice(0, at);
    const after = current.slice(at);
    const snippet = `${before && !before.endsWith("\n") ? "\n" : ""}![](${url})${after.startsWith("\n") ? "" : "\n"}`;
    set("extendedDescription", before + snippet + after);
  }

  return (
    <div className="flex flex-col gap-4">
      <Section title={t("partnerOrders.form.videoTitle")} hint={t("partnerOrders.form.videoHint")}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
          <div>
            <label className={labelClass} htmlFor="po-video">{t("admin.partnerAdsPanel.videoLinkMp4")}</label>
            <input
              id="po-video"
              className={inputClass}
              value={value.rewardVideoUrl ?? ""}
              onChange={(e) => {
                const url = text(e.target.value);
                onChange({ ...value, rewardVideoUrl: url, rewardPoints: url ? value.rewardPoints : null });
              }}
              placeholder="https://cdn.../video.mp4"
            />
            <PartnerMediaDrop advertiser kind="video" onUploaded={(url) => set("rewardVideoUrl", url)} />
          </div>
          <div>
            <label className={labelClass} htmlFor="po-video-points">{t("admin.partnerAdsPanel.pointsForWatching")}</label>
            <input
              id="po-video-points"
              type="number"
              min={1}
              max={SELF_SERVE_REWARD_POINTS_MAX}
              className={`${inputClass} sm:w-36`}
              value={value.rewardPoints ?? ""}
              disabled={!value.rewardVideoUrl}
              onChange={(e) => set("rewardPoints", points(e.target.value))}
            />
          </div>
        </div>
        <div>
          <label className={labelClass} htmlFor="po-extended">{t("admin.partnerAdsPanel.extendedDescriptionOptional")}</label>
          <textarea
            id="po-extended"
            onSelect={(e) => {
              extendedCaretRef.current = e.currentTarget.selectionStart;
            }}
            className={`${inputClass} font-mono text-xs`}
            rows={6}
            maxLength={EXTENDED_DESCRIPTION_MAX}
            value={value.extendedDescription ?? ""}
            onChange={(e) => set("extendedDescription", text(e.target.value))}
            placeholder={"## Título\n**negrito**, *itálico*, [link](https://...)\n![imagem](https://.../imagem.png)"}
          />
          <p className={`${hintClass} flex justify-between gap-2`}>
            <span>{t("admin.partnerAdsPanel.extendedDescriptionHint")}</span>
            <span className="tabular-nums">{(value.extendedDescription ?? "").length}/{EXTENDED_DESCRIPTION_MAX}</span>
          </p>
          <PartnerMediaDrop advertiser kind="image" compact onUploaded={insertExtendedImage} />
        </div>
      </Section>

      <Section title={t("partnerOrders.form.clickTitle")} hint={t("partnerOrders.form.clickHint")}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[auto_1fr]">
          <div>
            <label className={labelClass} htmlFor="po-click-points">{t("admin.partnerAdsPanel.pointsForClicking")}</label>
            <input
              id="po-click-points"
              type="number"
              min={1}
              max={SELF_SERVE_REWARD_POINTS_MAX}
              className={`${inputClass} sm:w-36`}
              value={value.clickRewardPoints ?? ""}
              onChange={(e) => {
                const amount = points(e.target.value);
                onChange({
                  ...value,
                  clickRewardPoints: amount,
                  clickRewardPlacement: amount ? (value.clickRewardPlacement ?? "both") : null,
                });
              }}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="po-click-placement">{t("admin.partnerAdsPanel.whereItApplies")}</label>
            <select
              id="po-click-placement"
              className={inputClass}
              value={value.clickRewardPlacement ?? "both"}
              disabled={!value.clickRewardPoints}
              onChange={(e) => set("clickRewardPlacement", e.target.value as PartnerClickRewardPlacement)}
            >
              <option value="both">{t("admin.partnerAdsPanel.cardAndVideo")}</option>
              <option value="video">{t("admin.partnerAdsPanel.videoPopupOnly")}</option>
              <option value="card">{t("admin.partnerAdsPanel.cardOnly")}</option>
            </select>
          </div>
        </div>
        <p className={hintClass}>{t("partnerOrders.form.pointsCap", { max: SELF_SERVE_REWARD_POINTS_MAX })}</p>
      </Section>

      <Section title={t("partnerOrders.form.scheduleTitle")} hint={t("partnerAdCustomizer.scheduleHint")}>
        <PartnerScheduleEditor
          advertiser
          schedules={value.schedules ?? []}
          onChange={(schedules) => set("schedules", schedules)}
          base={{
            title: value.title,
            description: value.description,
            imageUrl: value.imageUrl ?? "",
            iconUrl: value.iconUrl ?? "",
            buttonLabel: value.buttonLabel,
            buttonUrl: value.buttonUrl,
            backgroundColor: value.backgroundColor ?? "#111827",
            textColor: value.textColor ?? "#f4f4f5",
            buttonBackgroundColor: value.buttonBackgroundColor ?? "#10b981",
            buttonTextColor: value.buttonTextColor ?? "#ffffff",
          }}
        />
      </Section>
    </div>
  );
}
