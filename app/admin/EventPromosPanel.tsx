"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  createEventPromo,
  deleteEventPromo,
  fetchAdminEventPromos,
  updateEventPromo,
  type EventPromoStats,
} from "@/lib/adminApi";
import {
  EVENT_PROMO_THEMES,
  EVENT_PROMO_THEME_CLASSES,
  eventPromoPhase,
  type EventPromo,
  type EventPromoInput,
  type EventPromoInRoom,
  type EventPromoPosition,
} from "@/lib/eventPromo";
import { EventPromoCard, EventPromoPill } from "@/components/EventPromoCard";
import { useT } from "@/lib/useI18n";

// Writes the "acontecendo agora" corner card shown on every page of the site
// (components/EventPromoWidget.tsx). Every save is pushed live to everyone
// connected — there is no publish step beyond "Salvar".

const EMPTY: EventPromoInput = {
  enabled: true,
  badge: "",
  title: "",
  description: "",
  buttonLabel: "",
  url: "/events/",
  newTab: false,
  imageUrl: null,
  theme: "red",
  startsAt: null,
  endsAt: null,
  showBeforeStart: true,
  position: "bottom-left",
  inRoom: "minimized",
  dismissible: true,
  priority: 0,
};

function toInput(promo: EventPromo): EventPromoInput {
  return {
    enabled: promo.enabled,
    badge: promo.badge,
    title: promo.title,
    description: promo.description,
    buttonLabel: promo.buttonLabel,
    url: promo.url,
    newTab: promo.newTab,
    imageUrl: promo.imageUrl,
    theme: promo.theme,
    startsAt: promo.startsAt,
    endsAt: promo.endsAt,
    showBeforeStart: promo.showBeforeStart,
    position: promo.position,
    inRoom: promo.inRoom,
    dismissible: promo.dismissible,
    priority: promo.priority,
  };
}

// <input type="datetime-local"> speaks local wall-clock time with no zone.
function toLocalInput(ms: number | null): string {
  if (ms === null) return "";
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";
const labelClass = "flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400";

function Status({ promo, now }: { promo: EventPromo; now: number }) {
  const t = useT();
  if (!promo.enabled) {
    return <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[0.65rem] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">{t("admin.eventPromosPanel.statusOff")}</span>;
  }
  const phase = eventPromoPhase(promo, now);
  if (phase === "ended") {
    return <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[0.65rem] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">{t("admin.eventPromosPanel.statusEnded")}</span>;
  }
  if (phase === "upcoming") {
    return (
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[0.65rem] font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
        {promo.showBeforeStart ? t("admin.eventPromosPanel.statusCountdown") : t("admin.eventPromosPanel.statusScheduled")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[0.65rem] font-semibold text-red-700 dark:bg-red-500/15 dark:text-red-300">
      <span className="golive-live-dot h-1.5 w-1.5 rounded-full bg-red-500" />
      {t("admin.eventPromosPanel.statusLive")}
    </span>
  );
}

export function EventPromosPanel() {
  const t = useT();
  const [promos, setPromos] = useState<EventPromo[] | null>(null);
  const [stats, setStats] = useState<Record<string, EventPromoStats>>({});
  // null = form closed; "new" = creating; otherwise the id being edited.
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<EventPromoInput>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewMinimized, setPreviewMinimized] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  function apply(state: { promos: EventPromo[]; stats: Record<string, EventPromoStats> }) {
    setPromos(state.promos);
    setStats(state.stats);
  }

  // Counters move on their own, so they are refreshed while the tab is open.
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetchAdminEventPromos()
        .then((state) => {
          if (!cancelled) apply(state);
        })
        .catch(() => {
          if (!cancelled) setPromos((prev) => prev ?? []);
        });
    load();
    const timer = setInterval(load, 15_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  function set<K extends keyof EventPromoInput>(key: K, value: EventPromoInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function openNew() {
    setForm(EMPTY);
    setEditing("new");
    setError(null);
  }

  function openEdit(promo: EventPromo) {
    setForm(toInput(promo));
    setEditing(promo.id);
    setError(null);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setError(null);
    try {
      apply(editing === "new" ? await createEventPromo(form) : await updateEventPromo(editing, form));
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("admin.eventPromosPanel.couldNotSave"));
    } finally {
      setSaving(false);
    }
  }

  async function toggle(promo: EventPromo) {
    try {
      apply(await updateEventPromo(promo.id, { ...toInput(promo), enabled: !promo.enabled }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("admin.eventPromosPanel.couldNotSave"));
    }
  }

  async function remove(promo: EventPromo) {
    if (!window.confirm(t("admin.eventPromosPanel.confirmDelete", { title: promo.title }))) return;
    try {
      apply(await deleteEventPromo(promo.id));
      if (editing === promo.id) setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("admin.eventPromosPanel.couldNotSave"));
    }
  }

  const previewPromo: EventPromoInput = {
    ...form,
    title: form.title || t("admin.eventPromosPanel.previewTitle"),
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">{t("admin.eventPromosPanel.title")}</h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{t("admin.eventPromosPanel.help")}</p>
        </div>
        {editing === null && (
          <button
            type="button"
            onClick={openNew}
            className="shrink-0 rounded-lg bg-zinc-950 px-3 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            {t("admin.eventPromosPanel.new")}
          </button>
        )}
      </div>

      {error && editing === null && <p className="mt-3 text-sm text-red-500">{error}</p>}

      {editing === null && (
        <div className="mt-4 flex flex-col gap-2">
          {promos === null && <p className="text-sm text-zinc-500">{t("common.loading")}</p>}
          {promos?.length === 0 && <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("admin.eventPromosPanel.empty")}</p>}
          {promos?.map((promo) => {
            const s = stats[promo.id];
            return (
              <div
                key={promo.id}
                className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-3 sm:flex-row sm:items-center dark:border-zinc-800"
              >
                <span className={`h-8 w-1.5 shrink-0 rounded-full ${EVENT_PROMO_THEME_CLASSES[promo.theme].swatch} max-sm:hidden`} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{promo.title}</span>
                    <Status promo={promo} now={now} />
                  </div>
                  <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">{promo.url}</p>
                  <p className="mt-0.5 text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                    {t("admin.eventPromosPanel.stats", {
                      views: s?.views ?? 0,
                      clicks: s?.clicks ?? 0,
                      dismisses: s?.dismisses ?? 0,
                      ctr: s && s.views > 0 ? ((s.clicks / s.views) * 100).toFixed(1) : "0",
                    })}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button type="button" onClick={() => toggle(promo)} className="rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900">
                    {promo.enabled ? t("admin.eventPromosPanel.turnOff") : t("admin.eventPromosPanel.turnOn")}
                  </button>
                  <button type="button" onClick={() => openEdit(promo)} className="rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900">
                    {t("admin.eventPromosPanel.edit")}
                  </button>
                  <button type="button" onClick={() => remove(promo)} className="rounded-lg border border-red-300 px-2.5 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 dark:border-red-500/40 dark:text-red-400 dark:hover:bg-red-500/10">
                    {t("admin.eventPromosPanel.delete")}
                  </button>
                </div>
              </div>
            );
          })}
          {promos && promos.length > 0 && (
            <p className="text-[0.7rem] text-zinc-400 dark:text-zinc-500">{t("admin.eventPromosPanel.statsNote")}</p>
          )}
        </div>
      )}

      {editing !== null && (
        <div className="mt-4 grid gap-5 lg:grid-cols-[1fr_auto]">
          <form onSubmit={handleSave} className="flex min-w-0 flex-col gap-3">
            <label className={labelClass}>
              {t("admin.eventPromosPanel.fieldTitle")}
              <input className={inputClass} value={form.title} maxLength={80} required onChange={(e) => set("title", e.target.value)} placeholder={t("admin.eventPromosPanel.fieldTitlePlaceholder")} />
            </label>
            <label className={labelClass}>
              {t("admin.eventPromosPanel.fieldDescription")}
              <textarea className={inputClass} rows={3} value={form.description} maxLength={280} onChange={(e) => set("description", e.target.value)} />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={labelClass}>
                {t("admin.eventPromosPanel.fieldBadge")}
                <input className={inputClass} value={form.badge} maxLength={32} onChange={(e) => set("badge", e.target.value)} placeholder={t("eventPromo.defaultBadge")} />
              </label>
              <label className={labelClass}>
                {t("admin.eventPromosPanel.fieldButton")}
                <input className={inputClass} value={form.buttonLabel} maxLength={32} onChange={(e) => set("buttonLabel", e.target.value)} placeholder={t("eventPromo.defaultButton")} />
              </label>
            </div>
            <label className={labelClass}>
              {t("admin.eventPromosPanel.fieldUrl")}
              <input className={inputClass} value={form.url} maxLength={500} required onChange={(e) => set("url", e.target.value)} placeholder="/events/manifestacao" />
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input type="checkbox" checked={form.newTab} onChange={(e) => set("newTab", e.target.checked)} />
              {t("admin.eventPromosPanel.fieldNewTab")}
            </label>
            <label className={labelClass}>
              {t("admin.eventPromosPanel.fieldImage")}
              <input className={inputClass} value={form.imageUrl ?? ""} maxLength={500} onChange={(e) => set("imageUrl", e.target.value.trim() || null)} placeholder="https://..." />
            </label>

            <div className={labelClass}>
              {t("admin.eventPromosPanel.fieldColor")}
              <div className="flex gap-2">
                {EVENT_PROMO_THEMES.map((theme) => (
                  <button
                    key={theme}
                    type="button"
                    onClick={() => set("theme", theme)}
                    aria-label={theme}
                    aria-pressed={form.theme === theme}
                    className={`h-8 w-8 rounded-full bg-gradient-to-br ${EVENT_PROMO_THEME_CLASSES[theme].gradient} transition ${form.theme === theme ? "ring-2 ring-zinc-950 ring-offset-2 dark:ring-zinc-50 dark:ring-offset-zinc-950" : "opacity-70 hover:opacity-100"}`}
                  />
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className={labelClass}>
                {t("admin.eventPromosPanel.fieldStartsAt")}
                <input type="datetime-local" className={inputClass} value={toLocalInput(form.startsAt)} onChange={(e) => set("startsAt", fromLocalInput(e.target.value))} />
              </label>
              <label className={labelClass}>
                {t("admin.eventPromosPanel.fieldEndsAt")}
                <input type="datetime-local" className={inputClass} value={toLocalInput(form.endsAt)} onChange={(e) => set("endsAt", fromLocalInput(e.target.value))} />
              </label>
            </div>
            <p className="-mt-1 text-[0.7rem] text-zinc-400 dark:text-zinc-500">{t("admin.eventPromosPanel.scheduleHelp")}</p>
            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input type="checkbox" checked={form.showBeforeStart} onChange={(e) => set("showBeforeStart", e.target.checked)} />
              {t("admin.eventPromosPanel.fieldShowBeforeStart")}
            </label>

            <div className="grid gap-3 sm:grid-cols-3">
              <label className={labelClass}>
                {t("admin.eventPromosPanel.fieldPosition")}
                <select className={inputClass} value={form.position} onChange={(e) => set("position", e.target.value as EventPromoPosition)}>
                  <option value="bottom-left">{t("admin.eventPromosPanel.positionLeft")}</option>
                  <option value="bottom-right">{t("admin.eventPromosPanel.positionRight")}</option>
                </select>
              </label>
              <label className={labelClass}>
                {t("admin.eventPromosPanel.fieldInRoom")}
                <select className={inputClass} value={form.inRoom} onChange={(e) => set("inRoom", e.target.value as EventPromoInRoom)}>
                  <option value="minimized">{t("admin.eventPromosPanel.inRoomMinimized")}</option>
                  <option value="expanded">{t("admin.eventPromosPanel.inRoomExpanded")}</option>
                  <option value="hidden">{t("admin.eventPromosPanel.inRoomHidden")}</option>
                </select>
              </label>
              <label className={labelClass}>
                {t("admin.eventPromosPanel.fieldPriority")}
                <input type="number" className={inputClass} value={form.priority} onChange={(e) => set("priority", Number(e.target.value) || 0)} />
              </label>
            </div>

            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input type="checkbox" checked={form.dismissible} onChange={(e) => set("dismissible", e.target.checked)} />
              {t("admin.eventPromosPanel.fieldDismissible")}
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input type="checkbox" checked={form.enabled} onChange={(e) => set("enabled", e.target.checked)} />
              {t("admin.eventPromosPanel.fieldEnabled")}
            </label>

            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
              >
                {saving ? t("common.saving") : editing === "new" ? t("admin.eventPromosPanel.publish") : t("admin.eventPromosPanel.save")}
              </button>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                {t("admin.eventPromosPanel.cancel")}
              </button>
            </div>
          </form>

          <div className="flex flex-col items-center gap-3 lg:sticky lg:top-4 lg:self-start">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{t("admin.eventPromosPanel.preview")}</span>
            {previewMinimized ? (
              <EventPromoPill promo={previewPromo} now={now} onExpand={() => setPreviewMinimized(false)} onDismiss={form.dismissible ? () => {} : undefined} />
            ) : (
              <EventPromoCard promo={previewPromo} now={now} onMinimize={() => setPreviewMinimized(true)} preview />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
