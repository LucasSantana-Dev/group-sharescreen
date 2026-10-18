"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/lib/useI18n";
import { ROOM_TOUR_EVENTS, trackRoomTour, useRoomTour } from "@/lib/roomTour";

// O tutorial da primeira sala (ver lib/roomTour): um balão azul que passa por
// cada controle, com um destaque em volta dele. Os alvos são marcados no
// WatchRoom com `data-tour="<id>"`, e um passo cujo alvo não está na tela
// neste layout (o "Copiar link" no celular, o "Puxar para cima" no desktop,
// as Ferramentas fora do experiment delas) é pulado sozinho — por isso a
// mesma lista serve para desktop, celular e grupo.
//
// Muita coisa mora dentro do "⋯" (e, no celular, da gaveta "puxe para
// cima"): um passo com `containers` abre o primeiro deles onde o alvo
// aparecer, e o tour fecha o que abriu quando o passo seguinte não precisa
// mais dele. Um alvo marcado com `className="contents"` (um invólucro sem
// caixa própria) é medido pelos filhos.
//
// O destaque não bloqueia nada: a sala continua clicável durante o tour, e
// clicar no controle apontado é exatamente o que se espera de alguém curioso.

export type TourContainer = "menu" | "extras";
type Step = { id: string; target: string | null; containers?: TourContainer[] };

// Agrupados por onde moram, para o "⋯" e a gaveta abrirem uma vez só por
// trecho em vez de abrir e fechar a cada passo.
const STEPS: Step[] = [
  { id: "welcome", target: null },
  { id: "mic", target: "mic" },
  { id: "deafen", target: "deafen" },
  { id: "screen", target: "screen" },
  { id: "camera", target: "camera" },
  { id: "extras", target: "extras" },
  { id: "video", target: "video", containers: ["extras"] },
  { id: "music", target: "music", containers: ["extras"] },
  { id: "tools", target: "tools", containers: ["extras"] },
  { id: "raiseHand", target: "raiseHand", containers: ["extras"] },
  { id: "record", target: "record", containers: ["extras"] },
  { id: "invite", target: "invite" },
  { id: "people", target: "people" },
  { id: "chat", target: "chat" },
  { id: "roomTheme", target: "roomTheme" },
  { id: "manage", target: "manage" },
  { id: "more", target: "more" },
  { id: "streamer", target: "streamer", containers: ["extras", "menu"] },
  { id: "transcript", target: "transcript", containers: ["menu"] },
  { id: "translation", target: "translation", containers: ["menu"] },
  { id: "shortcuts", target: "shortcuts", containers: ["menu"] },
  { id: "noise", target: "noise", containers: ["menu"] },
  { id: "clips", target: "clips", containers: ["menu"] },
  { id: "recordingMode", target: "recordingMode", containers: ["menu"] },
  { id: "multiScreen", target: "multiScreen", containers: ["menu"] },
  { id: "theme", target: "theme", containers: ["menu"] },
  { id: "leave", target: "leave" },
];

const START_DELAY_MS = 1500;
const MEASURE_MS = 200;
// Medidas sem achar o alvo antes de desistir: mais folga logo depois de abrir
// um contêiner (o "⋯" entra animado), quase nenhuma quando ele já estava aberto.
const WAIT_AFTER_OPEN = 4;
const WAIT_ALREADY_OPEN = 1;
const BUBBLE_WIDTH = 300;
const MARGIN = 12;
const GAP = 12;
const PAD = 6;

type Rect = { top: number; left: number; width: number; height: number };

function measureNode(node: HTMLElement): Rect | null {
  const box = node.getBoundingClientRect();
  if (box.width > 0 && box.height > 0) return { top: box.top, left: box.left, width: box.width, height: box.height };
  // `display: contents`: a caixa é a soma dos filhos.
  let top = Infinity;
  let left = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const child of node.children) {
    const r = child.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    top = Math.min(top, r.top);
    left = Math.min(left, r.left);
    right = Math.max(right, r.right);
    bottom = Math.max(bottom, r.bottom);
  }
  if (top === Infinity) return null;
  return { top, left, width: right - left, height: bottom - top };
}

function findTarget(target: string): { node: HTMLElement; rect: Rect } | null {
  const nodes = document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`);
  for (const node of nodes) {
    const rect = measureNode(node);
    if (rect) return { node, rect };
  }
  return null;
}

// Um diálogo aberto (criar conta, qualidade da tela, "abrir no app") tem a
// vez: o tour espera ele fechar para não competir pela atenção.
function dialogOpen(): boolean {
  return Boolean(document.querySelector('[role="dialog"]:not([data-room-tour]), [aria-modal="true"]'));
}

function sameRect(a: Rect | null, b: Rect | null) {
  if (!a || !b) return a === b;
  return a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height;
}

export function RoomTour({
  active,
  onContainer,
}: {
  active: boolean;
  /** Abre/fecha o "⋯" ou a gaveta do celular para um passo. */
  onContainer: (container: TourContainer, open: boolean) => void;
}) {
  const t = useT();
  const tour = useRoomTour();
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [rawIndex, setIndex] = useState(0);
  // A medida é do passo em que foi feita: trocar de passo zera sozinho.
  const [measured, setMeasured] = useState<{ step: Step; rect: Rect } | null>(null);
  const [viewport, setViewport] = useState({ w: 0, h: 0 });

  const onContainerRef = useRef(onContainer);
  useEffect(() => {
    onContainerRef.current = onContainer;
  }, [onContainer]);
  // O contêiner que *o tour* abriu — o que a pessoa abriu sozinha não é dele
  // para fechar.
  const openedRef = useRef<TourContainer | null>(null);
  const setContainer = useCallback((container: TourContainer | null) => {
    const current = openedRef.current;
    if (current === container) return;
    if (current) onContainerRef.current(current, false);
    if (container) onContainerRef.current(container, true);
    openedRef.current = container;
  }, []);
  useEffect(() => () => setContainer(null), [setContainer]);

  // Do lado de controle do experiment: nada para mostrar, e a vez passa —
  // ligar a feature depois não deve pegar alguém que já não é novo.
  const { pending, ready, enabled, finish } = tour;
  useEffect(() => {
    if (pending && ready && !enabled) finish();
  }, [pending, ready, enabled, finish]);

  // Começa depois que a sala assentou e nenhum diálogo está aberto.
  useEffect(() => {
    if (!active || !pending || !enabled || steps) return;
    let timer = 0;
    const tryStart = () => {
      if (dialogOpen()) {
        timer = window.setTimeout(tryStart, 1000);
        return;
      }
      // Os que moram num contêiner fechado só são conferidos na vez deles.
      const available = STEPS.filter((step) => !step.target || step.containers || findTarget(step.target));
      if (!available.some((step) => step.target && findTarget(step.target))) return;
      setSteps(available);
      setIndex(0);
      trackRoomTour(ROOM_TOUR_EVENTS.start, available.length);
    };
    timer = window.setTimeout(tryStart, START_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [active, pending, enabled, steps]);

  // Passos podem sumir no caminho (ver drop): o índice nunca passa do fim.
  const index = steps ? Math.min(rawIndex, steps.length - 1) : 0;
  const step = steps?.[index] ?? null;
  const rect = measured && measured.step === step ? measured.rect : null;
  const running = Boolean(step) && pending;

  useEffect(() => {
    if (running && step) trackRoomTour(ROOM_TOUR_EVENTS.step, STEPS.indexOf(step) + 1);
  }, [running, step]);

  const close = useCallback(
    (completed: boolean) => {
      trackRoomTour(
        completed ? ROOM_TOUR_EVENTS.complete : ROOM_TOUR_EVENTS.skip,
        completed || !step ? undefined : STEPS.indexOf(step) + 1
      );
      setContainer(null);
      finish();
      setSteps(null);
    },
    [finish, step, setContainer]
  );

  // Para que lado andar quando um passo some no caminho.
  const directionRef = useRef<1 | -1>(1);
  const next = useCallback(() => {
    if (!steps) return;
    directionRef.current = 1;
    if (index >= steps.length - 1) close(true);
    else setIndex(index + 1);
  }, [steps, index, close]);
  const back = useCallback(() => {
    directionRef.current = -1;
    setIndex(Math.max(0, index - 1));
  }, [index]);

  // Segue o alvo: o layout da sala muda o tempo todo (alguém entra, a tela
  // começa, o chat é redimensionado), e um balão apontando para onde o botão
  // *estava* é pior que nenhum.
  useEffect(() => {
    if (!running || !step) return;
    // A gaveta só existe no celular: no desktop, nem tenta.
    const order = (step.containers ?? []).filter((c) => c !== "extras" || findTarget("extras"));
    const opened = openedRef.current;
    let attempt = opened && order.includes(opened) ? order.indexOf(opened) + 1 : 0;
    // Um passo de fora do contêiner aberto: fecha antes de procurar.
    if (opened && !order.includes(opened)) setContainer(null);
    let missing = 0;
    let wait = WAIT_ALREADY_OPEN;
    let scrolled = false;

    const drop = () => {
      const goingBack = directionRef.current === -1;
      setSteps((list) => (list ? list.filter((s) => s !== step) : list));
      if (goingBack) setIndex((i) => Math.max(0, i - 1));
    };

    const measure = () => {
      setViewport((v) =>
        v.w === window.innerWidth && v.h === window.innerHeight ? v : { w: window.innerWidth, h: window.innerHeight }
      );
      if (!step.target) return;
      const found = findTarget(step.target);
      if (found) {
        missing = 0;
        if (!scrolled && openedRef.current) {
          // Dentro do "⋯", que rola: traz a linha para a vista.
          scrolled = true;
          found.node.scrollIntoView({ block: "nearest" });
          const again = findTarget(step.target);
          if (again) found.rect = again.rect;
        }
        setMeasured((m) => (m && m.step === step && sameRect(m.rect, found.rect) ? m : { step, rect: found.rect }));
        return;
      }
      setMeasured((m) => (m && m.step === step ? null : m));
      // Nada fora: abre o primeiro contêiner onde ele pode estar.
      if (attempt === 0 && order.length > 0 && !openedRef.current) {
        setContainer(order[0]);
        attempt = 1;
        missing = 0;
        wait = WAIT_AFTER_OPEN;
        return;
      }
      missing += 1;
      if (missing < wait) return;
      if (attempt < order.length) {
        setContainer(order[attempt]);
        attempt += 1;
        missing = 0;
        wait = WAIT_AFTER_OPEN;
        return;
      }
      // Não existe neste layout (ou sumiu: o layout mudou de desktop para
      // celular, a pessoa entrou num grupo) — pula em vez de apontar o nada.
      drop();
    };
    measure();
    const timer = window.setInterval(measure, MEASURE_MS);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [running, step, setContainer]);

  useEffect(() => {
    if (!running) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close(false);
        return;
      }
      const el = event.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (event.key === "ArrowRight") next();
      else if (event.key === "ArrowLeft") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [running, close, next, back]);

  if (!running || !step || !steps || typeof document === "undefined") return null;
  // Um passo com alvo espera a primeira medida, para não piscar no meio da tela.
  if (step.target && !rect) return null;

  const vw = viewport.w || window.innerWidth;
  const vh = viewport.h || window.innerHeight;
  const width = Math.min(BUBBLE_WIDTH, vw - MARGIN * 2);
  const isLast = index === steps.length - 1;

  // Onde o balão fica: embaixo do alvo se couber, senão em cima; um alvo alto
  // (a coluna do chat, a lista de pessoas) ganha o balão ao lado.
  let bubbleStyle: CSSProperties;
  let arrow: { side: "top" | "bottom" | "left" | "right"; offset: number } | null = null;
  if (!rect) {
    bubbleStyle = { left: (vw - width) / 2, top: Math.max(MARGIN, vh / 2 - 110) };
  } else {
    const centerX = rect.left + rect.width / 2;
    const tall = rect.height > vh * 0.45;
    if (tall) {
      const roomLeft = rect.left - PAD - GAP - MARGIN;
      const roomRight = vw - (rect.left + rect.width) - PAD - GAP - MARGIN;
      const top = Math.min(Math.max(MARGIN, rect.top + 48), vh - 240);
      if (roomLeft >= width || roomRight >= width) {
        const onLeft = roomLeft >= width;
        bubbleStyle = {
          top,
          left: onLeft ? rect.left - PAD - GAP - width : rect.left + rect.width + PAD + GAP,
        };
        arrow = { side: onLeft ? "right" : "left", offset: 24 };
      } else {
        // Alvo da largura da tela (a gaveta do celular): por cima dele.
        bubbleStyle = { left: (vw - width) / 2, top };
      }
    } else {
      const left = Math.min(Math.max(MARGIN, centerX - width / 2), vw - width - MARGIN);
      const offset = Math.min(Math.max(16, centerX - left), width - 16);
      const below = rect.top + rect.height + PAD + GAP;
      if (below + 200 <= vh) {
        bubbleStyle = { left, top: below };
        arrow = { side: "top", offset };
      } else {
        bubbleStyle = { left, bottom: vh - rect.top + PAD + GAP };
        arrow = { side: "bottom", offset };
      }
    }
  }

  const arrowClass = "absolute h-2.5 w-2.5 rotate-45 bg-blue-600";
  const arrowStyle: CSSProperties | undefined = arrow
    ? arrow.side === "top"
      ? { top: -5, left: arrow.offset - 5 }
      : arrow.side === "bottom"
        ? { bottom: -5, left: arrow.offset - 5 }
        : arrow.side === "left"
          ? { left: -5, top: arrow.offset - 5 }
          : { right: -5, top: arrow.offset - 5 }
    : undefined;

  // A boas-vindas não conta como passo no "1 de N".
  const counted = steps[0]?.target === null ? steps.length - 1 : steps.length;
  const position = steps[0]?.target === null ? index : index + 1;

  return createPortal(
    <>
      {rect ? (
        <div
          aria-hidden
          className="pointer-events-none fixed z-[1100] rounded-xl ring-2 ring-blue-500 transition-all duration-200"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.5)",
          }}
        />
      ) : (
        <div aria-hidden className="pointer-events-none fixed inset-0 z-[1100] bg-black/50" />
      )}
      <div
        role="dialog"
        aria-modal="false"
        aria-label={t("roomTour.label")}
        data-room-tour=""
        // Clicar em "Próximo" não é clicar fora do "⋯" aberto pelo tour
        // (ver Popover em components/Tooltip).
        data-keep-popovers=""
        className="fixed z-[1101] rounded-xl bg-blue-600 p-4 text-left text-white shadow-2xl transition-[top,left,bottom] duration-200"
        style={{ ...bubbleStyle, width }}
      >
        {arrowStyle && <span className={arrowClass} style={arrowStyle} />}
        {position > 0 && (
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-white/70">
            {t("roomTour.progress", { current: position, total: counted })}
          </p>
        )}
        <p className="text-sm font-semibold">{t(`roomTour.${step.id}.title`)}</p>
        <p className="mt-1 text-[13px] leading-snug text-white/90">{t(`roomTour.${step.id}.text`)}</p>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => close(false)}
            className="-ml-1 rounded px-1 py-1 text-xs font-medium text-white/80 underline-offset-2 hover:text-white hover:underline"
          >
            {t("roomTour.skip")}
          </button>
          <span className="flex-1" />
          {index > 0 && (
            <button
              type="button"
              onClick={back}
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-white/90 hover:bg-white/10"
            >
              {t("roomTour.back")}
            </button>
          )}
          <button
            type="button"
            onClick={next}
            autoFocus
            className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 shadow-sm hover:bg-blue-50"
          >
            {index === 0 && !step.target ? t("roomTour.start") : isLast ? t("roomTour.done") : t("roomTour.next")}
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}
