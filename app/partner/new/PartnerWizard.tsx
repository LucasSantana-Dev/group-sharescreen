"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { MdArrowBack, MdArrowForward, MdCheck } from "react-icons/md";
import { creativeProblem, PartnerCreativeForm } from "@/components/partnerOrders/PartnerCreativeForm";
import {
  PartnerAudienceStats,
  PartnerDiscordBanner,
  PartnerPackagePicker,
  PartnerPreviewPanel,
} from "@/components/partnerOrders/PartnerOrderParts";
import { PartnerCheckout } from "@/components/partnerOrders/PartnerCheckout";
import { PartnerSignInGate } from "../PartnerSignInGate";
import { useAuth } from "@/lib/AuthContext";
import { useFeature } from "@/lib/features";
import { useT } from "@/lib/useI18n";
import {
  SELF_SERVE_PARTNER_EVENTS,
  SELF_SERVE_PARTNER_FEATURE,
  blankCreative,
  createPartnerOrder,
  creativeOf,
  fetchPartnerOrder,
  fetchPartnerOrderConfig,
  packageDurationLabel,
  trackPartnerOrderEvent,
  updatePartnerOrder,
  type PartnerCreative,
  type PartnerOrder,
  type PartnerOrderConfig,
} from "@/lib/partnerOrders";

// "Criar anúncio", in four steps: how long, the card, the extras, pay. The
// draft is kept in this browser while it is being written, so a closed tab or
// a trip to the bank app does not lose it.

const DRAFT_KEY = "golive:partner-order-draft";

type Draft = { packageId: string | null; creative: PartnerCreative; orderId: string | null };

function readDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Draft;
    return parsed && parsed.creative ? { ...parsed, creative: creativeOf(parsed.creative) } : null;
  } catch {
    return null;
  }
}

function writeDraft(draft: Draft | null) {
  try {
    if (draft) localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    else localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Private window: the draft just lives as long as the tab.
  }
}

export function PartnerWizard() {
  const t = useT();
  const router = useRouter();
  const search = useSearchParams();
  const { account, loading } = useAuth();
  // Counted here: the builder and the dashboard are where the experiment's
  // feature actually is (see SELF_SERVE_PARTNER_FEATURE).
  useFeature(SELF_SERVE_PARTNER_FEATURE, { track: true });
  const [config, setConfig] = useState<PartnerOrderConfig | null>(null);
  const [step, setStep] = useState(0);
  const [packageId, setPackageId] = useState<string | null>(null);
  const [creative, setCreative] = useState<PartnerCreative>(blankCreative);
  const [order, setOrder] = useState<PartnerOrder | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const restored = useRef(false);

  const steps = [
    t("partnerOrders.wizard.stepPlan"),
    t("partnerOrders.wizard.stepCard"),
    t("partnerOrders.wizard.stepExtras"),
    t("partnerOrders.wizard.stepPay"),
  ];

  useEffect(() => {
    fetchPartnerOrderConfig()
      .then(setConfig)
      .catch(() => setConfig({ packages: [], methods: { pix: false, card: false } }));
  }, []);

  // Starting point: a renewal copies an earlier order; otherwise the draft
  // this browser kept; otherwise a blank card.
  useEffect(() => {
    if (restored.current || loading) return;
    restored.current = true;
    const from = search.get("from");
    const pkg = search.get("package");
    if (from && account) {
      fetchPartnerOrder(from)
        .then((source) => {
          setCreative(creativeOf(source.creative));
          setPackageId(pkg ?? source.packageId);
          trackPartnerOrderEvent(SELF_SERVE_PARTNER_EVENTS.renew);
        })
        .catch(() => undefined);
      return;
    }
    const draft = readDraft();
    // Applied a tick later: localStorage is not there during the server render,
    // so the first client render has to match it before the draft comes in.
    void Promise.resolve().then(() => {
      if (draft) {
        setCreative(draft.creative);
        setPackageId(pkg ?? draft.packageId);
        if (draft.orderId) {
          fetchPartnerOrder(draft.orderId)
            .then((existing) => {
              if (existing.status === "awaiting_payment") setOrder(existing);
              else writeDraft({ ...draft, orderId: null });
            })
            .catch(() => undefined);
        }
      } else if (pkg) {
        setPackageId(pkg);
      }
    });
  }, [account, loading, search]);

  useEffect(() => {
    if (!restored.current) return;
    writeDraft({ packageId, creative, orderId: order?.id ?? null });
  }, [packageId, creative, order]);

  useEffect(() => {
    trackPartnerOrderEvent(`${SELF_SERVE_PARTNER_EVENTS.wizardStep}_${step + 1}`);
  }, [step]);

  const pkg = config?.packages.find((p) => p.id === packageId) ?? null;

  function canLeave(from: number): string | null {
    if (from === 0 && !pkg) return t("partnerOrders.wizard.choosePlan");
    if (from >= 1) return creativeProblem(creative, t);
    return null;
  }

  function go(to: number) {
    if (to > step) {
      for (let s = step; s < to; s++) {
        const why = canLeave(s);
        if (why) {
          setProblem(why);
          setStep(s);
          return;
        }
      }
    }
    setProblem(null);
    setStep(to);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /** Creates the order (or saves the edits on the one already created) right before paying. */
  async function prepare(): Promise<PartnerOrder | null> {
    if (!pkg) return null;
    const why = creativeProblem(creative, t);
    if (why) {
      setProblem(why);
      return null;
    }
    const saved = order
      ? await updatePartnerOrder(order.id, creative, pkg.id)
      : await createPartnerOrder(pkg.id, creative);
    if (!order) trackPartnerOrderEvent(SELF_SERVE_PARTNER_EVENTS.created, saved.amountCents);
    setOrder(saved);
    return saved;
  }

  if (!loading && !account) return <PartnerSignInGate />;

  return (
    <main className="mx-auto w-full max-w-5xl grow px-4 py-6 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/partner"
          className="flex items-center gap-1 text-sm text-zinc-500 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          <MdArrowBack className="h-4 w-4" />
          {t("partnerOrders.myAds")}
        </Link>
      </div>
      <h1 className="mt-3 text-2xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
        {t("partnerOrders.wizard.title")}
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{t("partnerOrders.wizard.subtitle")}</p>

      {/* The steps, clickable backwards and (when the current one is done) forwards. */}
      <ol className="mt-5 grid grid-cols-4 gap-2">
        {steps.map((label, index) => {
          const done = index < step;
          const current = index === step;
          return (
            <li key={label}>
              <button
                type="button"
                onClick={() => go(index)}
                className={`flex w-full flex-col items-start gap-1 border-t-4 pt-2 text-left text-xs font-semibold transition sm:text-sm ${
                  current
                    ? "border-emerald-500 text-zinc-950 dark:text-zinc-50"
                    : done
                      ? "border-emerald-300 text-zinc-600 dark:border-emerald-800 dark:text-zinc-300"
                      : "border-zinc-200 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500"
                }`}
              >
                <span className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide opacity-80">
                  {done ? <MdCheck className="h-3.5 w-3.5 text-emerald-600" /> : null}
                  {t("partnerOrders.wizard.stepN", { n: index + 1 })}
                </span>
                <span className="truncate">{label}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          {step === 0 && (
            <div className="flex flex-col gap-5">
              <section>
                <h2 className="mb-2 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
                  {t("partnerOrders.wizard.planTitle")}
                </h2>
                {config === null ? (
                  <p className="text-sm text-zinc-500">{t("common.loading")}</p>
                ) : (
                  <PartnerPackagePicker packages={config.packages} value={packageId} onChange={setPackageId} />
                )}
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{t("partnerOrders.wizard.planHint")}</p>
              </section>
              <PartnerAudienceStats />
            </div>
          )}
          {step === 1 && <PartnerCreativeForm section="card" value={creative} onChange={setCreative} />}
          {step === 2 && <PartnerCreativeForm section="extras" value={creative} onChange={setCreative} />}
          {step === 3 && (
            <div className="flex flex-col gap-4">
              <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">{t("partnerOrders.wizard.reviewTitle")}</h2>
                <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                  <SummaryRow label={t("partnerOrders.wizard.summaryDuration")} value={pkg ? packageDurationLabel(pkg.hours) : "—"} />
                  <SummaryRow label={t("partnerOrders.wizard.summaryPrice")} value={pkg?.priceLabel ?? "—"} strong />
                  <SummaryRow label={t("common.title")} value={creative.title} />
                  <SummaryRow label={t("common.buttonLink")} value={creative.buttonUrl} />
                  <SummaryRow
                    label={t("partnerOrders.wizard.summaryVideo")}
                    value={creative.rewardVideoUrl && creative.rewardPoints ? t("partnerOrders.wizard.pointsEach", { points: creative.rewardPoints }) : t("partnerOrders.wizard.none")}
                  />
                  <SummaryRow
                    label={t("partnerOrders.wizard.summaryClick")}
                    value={creative.clickRewardPoints ? t("partnerOrders.wizard.pointsEach", { points: creative.clickRewardPoints }) : t("partnerOrders.wizard.none")}
                  />
                  <SummaryRow
                    label={t("partnerOrders.wizard.summarySchedules")}
                    value={String((creative.schedules ?? []).length || t("partnerOrders.wizard.none"))}
                  />
                </dl>
                <ul className="mt-4 flex flex-col gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                  <li>• {t("partnerOrders.wizard.ruleReview")}</li>
                  <li>• {t("partnerOrders.wizard.ruleStart")}</li>
                  <li>• {t("partnerOrders.wizard.ruleEdit")}</li>
                </ul>
              </section>
              {config && pkg && (
                <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                  <h2 className="mb-3 text-lg font-semibold text-zinc-950 dark:text-zinc-50">{t("partnerOrders.wizard.payTitle")}</h2>
                  <PartnerCheckout
                    order={order}
                    amountLabel={pkg.priceLabel}
                    methods={config.methods}
                    prepare={prepare}
                    onPaid={(paidOrder) => {
                      writeDraft(null);
                      router.push(`/partner/${encodeURIComponent(paidOrder.id)}?paid=1`);
                    }}
                  />
                </section>
              )}
            </div>
          )}

          {problem && <p className="mt-4 text-sm font-medium text-red-500">{problem}</p>}

          {step < 3 && (
            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => go(step - 1)}
                disabled={step === 0}
                className="flex items-center gap-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-100 disabled:invisible dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                <MdArrowBack className="h-4 w-4" />
                {t("common.back")}
              </button>
              <button
                type="button"
                onClick={() => go(step + 1)}
                className="flex items-center gap-1 rounded-xl bg-zinc-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
              >
                {step === 2 ? t("partnerOrders.wizard.toPayment") : t("partnerOrders.wizard.next")}
                <MdArrowForward className="h-4 w-4" />
              </button>
            </div>
          )}
          {step === 3 && (
            <button
              type="button"
              onClick={() => go(2)}
              className="mt-4 flex items-center gap-1 text-sm font-semibold text-zinc-600 dark:text-zinc-300"
            >
              <MdArrowBack className="h-4 w-4" />
              {t("common.back")}
            </button>
          )}
        </div>

        {/* Always in view: the card being built, and the way to a human. */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
          {step > 0 && <PartnerPreviewPanel creative={creative} />}
          {pkg && (
            <div className="rounded-xl border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-950">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{t("partnerOrders.wizard.summaryDuration")}</p>
              <p className="flex items-baseline justify-between gap-2 font-semibold text-zinc-950 dark:text-zinc-50">
                {packageDurationLabel(pkg.hours)}
                <span className="text-lg tabular-nums">{pkg.priceLabel}</span>
              </p>
            </div>
          )}
          <PartnerDiscordBanner source="wizard" stacked />
        </aside>
      </div>
    </main>
  );
}

function SummaryRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex min-w-0 justify-between gap-3 border-b border-zinc-100 py-1.5 dark:border-zinc-900">
      <dt className="shrink-0 text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className={`min-w-0 truncate text-right ${strong ? "font-bold text-zinc-950 dark:text-zinc-50" : "text-zinc-800 dark:text-zinc-200"}`}>
        {value}
      </dd>
    </div>
  );
}
