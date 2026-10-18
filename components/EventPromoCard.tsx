"use client";

import {
  EVENT_PROMO_THEME_CLASSES,
  eventPromoPhase,
  formatCountdown,
  type EventPromoInput,
} from "@/lib/eventPromo";
import { useT } from "@/lib/useI18n";

// The look of the "acontecendo agora" card, with no state of its own — the
// site's EventPromoWidget decides what to show and when, and the admin panel
// renders this same component as its live preview, so what the admin sees
// while typing is exactly what goes out.

type Props = {
  promo: EventPromoInput;
  now: number;
  onClick?: () => void;
  onMinimize?: () => void;
  /** "1 de 3" with arrows, when more than one promo is up. */
  pager?: { index: number; total: number; onPrev: () => void; onNext: () => void };
  /** In the admin preview the link must not navigate. */
  preview?: boolean;
};

function LiveDot() {
  return (
    <span className="relative flex h-2.5 w-2.5 shrink-0">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75 motion-reduce:animate-none" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
    </span>
  );
}

export function EventPromoCard({ promo, now, onClick, onMinimize, pager, preview }: Props) {
  const t = useT();
  const theme = EVENT_PROMO_THEME_CLASSES[promo.theme];
  const phase = eventPromoPhase(promo, now);
  const upcoming = phase === "upcoming";
  const badge = upcoming ? t("eventPromo.upcoming") : promo.badge || t("eventPromo.defaultBadge");
  const buttonLabel = promo.buttonLabel || t("eventPromo.defaultButton");

  return (
    <div
      className={`event-promo-in relative w-[320px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl bg-gradient-to-br ${theme.gradient} p-4 text-white shadow-2xl ${theme.glow} ring-2 ${theme.ring}`}
      role="region"
      aria-label={badge}
    >
      {/* Soft light from the top-left corner, so the gradient reads as a card
          and not a flat block of color. */}
      <div className="pointer-events-none absolute -left-16 -top-16 h-40 w-40 rounded-full bg-white/20 blur-2xl" />

      <div className="relative flex items-center gap-2">
        <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-black/25 px-2.5 py-1 text-[0.65rem] font-extrabold uppercase tracking-wider">
          {upcoming ? <span className="h-2 w-2 shrink-0 rounded-full bg-white/80" /> : <LiveDot />}
          <span className="truncate">{badge}</span>
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-0.5">
          {pager && pager.total > 1 && (
            <>
              <button
                type="button"
                onClick={pager.onPrev}
                aria-label={t("eventPromo.previous")}
                className="flex h-6 w-6 items-center justify-center rounded-full text-white/80 transition hover:bg-white/20 hover:text-white"
              >
                ‹
              </button>
              <span className="text-[0.65rem] font-semibold tabular-nums text-white/80">
                {t("eventPromo.counter", { current: pager.index + 1, total: pager.total })}
              </span>
              <button
                type="button"
                onClick={pager.onNext}
                aria-label={t("eventPromo.next")}
                className="flex h-6 w-6 items-center justify-center rounded-full text-white/80 transition hover:bg-white/20 hover:text-white"
              >
                ›
              </button>
            </>
          )}
          {onMinimize && (
            <button
              type="button"
              onClick={onMinimize}
              aria-label={t("eventPromo.minimize")}
              title={t("eventPromo.minimize")}
              className="flex h-6 w-6 items-center justify-center rounded-full text-white/80 transition hover:bg-white/20 hover:text-white"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      {promo.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- admin-provided URL on any host
        <img
          src={promo.imageUrl}
          alt=""
          className="relative mt-3 h-28 w-full rounded-xl object-cover shadow-md"
          loading="lazy"
        />
      )}

      <h3 className="relative mt-3 text-lg font-extrabold leading-tight [text-wrap:balance]">{promo.title}</h3>
      {promo.description && (
        <p className="relative mt-1 line-clamp-3 whitespace-pre-line text-sm leading-snug text-white/90">
          {promo.description}
        </p>
      )}

      {upcoming && promo.startsAt !== null && (
        <p className="relative mt-2 inline-flex items-center gap-1.5 rounded-lg bg-black/20 px-2 py-1 text-xs font-semibold tabular-nums">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden>
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .2.08.39.22.53l3 3a.75.75 0 101.06-1.06l-2.78-2.78V5z"
              clipRule="evenodd"
            />
          </svg>
          {t("eventPromo.startsIn", { time: formatCountdown(promo.startsAt - now) })}
        </p>
      )}

      <a
        href={preview ? undefined : promo.url}
        target={promo.newTab ? "_blank" : undefined}
        rel={promo.newTab ? "noopener noreferrer" : undefined}
        onClick={(e) => {
          if (preview) e.preventDefault();
          onClick?.();
        }}
        className={`relative mt-3 flex w-full cursor-pointer items-center justify-center gap-1.5 overflow-hidden rounded-xl px-4 py-2.5 text-sm font-extrabold shadow-lg transition active:scale-[0.98] ${theme.button}`}
      >
        <span className="golive-shine pointer-events-none absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-transparent via-black/10 to-transparent" />
        <span className="relative">{buttonLabel}</span>
        <svg viewBox="0 0 20 20" fill="currentColor" className="relative h-4 w-4" aria-hidden>
          <path
            fillRule="evenodd"
            d="M3 10a.75.75 0 01.75-.75h10.64l-4.22-4.22a.75.75 0 111.06-1.06l5.5 5.5a.75.75 0 010 1.06l-5.5 5.5a.75.75 0 11-1.06-1.06l4.22-4.22H3.75A.75.75 0 013 10z"
            clipRule="evenodd"
          />
        </svg>
      </a>
    </div>
  );
}

type PillProps = {
  promo: EventPromoInput;
  now: number;
  onExpand: () => void;
  onDismiss?: () => void;
};

/** The minimized form: a pulsing pill that still says something is on. */
export function EventPromoPill({ promo, now, onExpand, onDismiss }: PillProps) {
  const t = useT();
  const theme = EVENT_PROMO_THEME_CLASSES[promo.theme];
  const upcoming = eventPromoPhase(promo, now) === "upcoming";

  return (
    <div
      className={`event-promo-in flex max-w-[calc(100vw-2rem)] items-center overflow-hidden rounded-full bg-gradient-to-r ${theme.gradient} text-white shadow-xl ${theme.glow} ring-2 ${theme.ring}`}
    >
      <button
        type="button"
        onClick={onExpand}
        title={t("eventPromo.expand")}
        className="flex min-w-0 items-center gap-2 py-2 pl-3 pr-3 text-xs font-bold transition hover:bg-white/10"
      >
        {upcoming ? <span className="h-2 w-2 shrink-0 rounded-full bg-white/80" /> : <LiveDot />}
        <span className="shrink-0 uppercase tracking-wider">
          {upcoming && promo.startsAt !== null
            ? formatCountdown(promo.startsAt - now)
            : t("eventPromo.live")}
        </span>
        <span className="max-w-[180px] truncate font-semibold text-white/90">{promo.title}</span>
      </button>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t("eventPromo.close")}
          title={t("eventPromo.close")}
          className="flex h-full items-center border-l border-white/20 px-2.5 py-2 text-white/80 transition hover:bg-white/10 hover:text-white"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden>
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
      )}
    </div>
  );
}
