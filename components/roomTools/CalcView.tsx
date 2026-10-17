"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { MdBackspace, MdContentCopy, MdDeleteSweep, MdHistory, MdClose } from "react-icons/md";
import { evaluate, formatNumber } from "@/lib/calc";
import { roomTools, type CalcTool } from "@/lib/roomTools";
import { useT } from "@/lib/useI18n";

// The room's calculator, as a tile: one display everybody types into (the
// last keystroke wins), a keypad — basic, or scientific — and the tape of
// what "=" worked out, which the server does (see the API's calcEquals) so
// it reads the same for everybody.

const FUNCTION_KEYS = ["sin", "cos", "tan", "asin", "acos", "atan", "ln", "log", "√"] as const;
const OPERATORS = ["+", "−", "×", "÷", "^"];

/** The display after pressing `key`, from `expr` — `fresh` when it shows a result just worked out. */
export function pressKey(expr: string, key: string, fresh: boolean, memory: number): string {
  const last = expr.slice(-1);
  // After "=", a number starts over; an operator carries on from the result.
  const startsOver = fresh && !OPERATORS.includes(key) && key !== "%" && key !== "!" && key !== "^2" && key !== "1/x" && key !== "±";
  const base = startsOver ? "" : expr;
  switch (key) {
    case "C":
      return "";
    case "⌫": {
      if (fresh) return "";
      const fn = /(asin|acos|atan|sin|cos|tan|ln|log|√|ans)\(?$/.exec(expr);
      return fn ? expr.slice(0, fn.index) : expr.slice(0, -1);
    }
    case "±": {
      if (!expr) return "−";
      // A result's minus is "-", a typed one "−".
      if (/^[−-]?\d+(\.\d*)?(e[+-]\d+)?$/.test(expr)) return /^[−-]/.test(expr) ? expr.slice(1) : `−${expr}`;
      return expr.startsWith("−(") && expr.endsWith(")") ? expr.slice(2, -1) : `−(${expr})`;
    }
    case "^2":
      return expr ? `${expr}^2` : expr;
    case "1/x":
      return expr ? `1÷(${expr})` : expr;
    case "MR":
      return `${base}${formatNumber(memory).replace(/^-/, "−")}`;
    case "ans":
      return `${base}ans`;
    case ".": {
      const number = /[\d.]*$/.exec(base)?.[0] ?? "";
      if (number.includes(".")) return base;
      return `${base}${number ? "" : "0"}.`;
    }
  }
  if (FUNCTION_KEYS.includes(key as (typeof FUNCTION_KEYS)[number])) return `${base}${key}(`;
  if (OPERATORS.includes(key)) {
    // Two operators in a row: the new one replaces the old — except a minus
    // after one, which is a negative number (2×−3).
    if (!expr) return key === "−" ? "−" : "";
    if (OPERATORS.includes(last) && !(key === "−" && last !== "−")) return `${expr.slice(0, -1)}${key}`;
    return `${expr}${key}`;
  }
  return `${base}${key}`;
}

/** A key typed on the keyboard as the keypad's key, or null. */
function keyFromKeyboard(e: KeyboardEvent | React.KeyboardEvent): string | null {
  const k = e.key;
  if (/^[0-9]$/.test(k)) return k;
  const map: Record<string, string> = {
    "+": "+",
    "-": "−",
    "*": "×",
    x: "×",
    "/": "÷",
    "^": "^",
    "%": "%",
    "!": "!",
    "(": "(",
    ")": ")",
    ".": ".",
    ",": ".",
    p: "π",
    e: "e",
    Backspace: "⌫",
    Delete: "C",
    Escape: "C",
    Enter: "=",
    "=": "=",
  };
  return map[k] ?? null;
}

export function CalcView({ tool, isManager, canUse }: { tool: CalcTool; isManager: boolean; canUse: boolean }) {
  const t = useT();
  const boxRef = useRef<HTMLDivElement>(null);
  const [narrow, setNarrow] = useState(false);
  const [tapeOpen, setTapeOpen] = useState(true);
  const [scientific, setScientific] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const observer = new ResizeObserver(([entry]) => {
      const isNarrow = entry.contentRect.width < 520;
      setNarrow((was) => {
        if (isNarrow !== was) setTapeOpen(!isNarrow);
        return isNarrow;
      });
    });
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  const ans = tool.history[0] ? Number(tool.history[0].result) || 0 : 0;
  // Showing the result of "=", untouched since — the next number starts over.
  const fresh = Boolean(tool.history[0] && tool.expr === tool.history[0].result);
  const preview = tool.expr && !fresh ? evaluate(tool.expr, { mode: tool.angle, ans }) : null;

  function press(key: string) {
    if (!canUse) return;
    if (key === "=") {
      if (tool.expr && !fresh) roomTools.calcEquals(tool.id);
      return;
    }
    const next = pressKey(tool.expr, key, fresh, tool.memory);
    if (next !== tool.expr && next.length <= 200) roomTools.calcSet(tool.id, next);
  }

  async function copy() {
    const value = fresh ? tool.expr : preview?.ok ? formatNumber(preview.value) : tool.expr;
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value.replace(/−/g, "-"));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {}
  }

  const key = (label: ReactNode, value: string, style: "num" | "op" | "fn" | "eq" | "mem" = "num", extra = "") => (
    <button
      key={value}
      type="button"
      disabled={!canUse}
      onClick={() => press(value)}
      className={`flex min-h-0 items-center justify-center rounded-lg text-sm font-semibold transition active:scale-95 disabled:opacity-50 sm:text-base ${
        style === "eq"
          ? "bg-emerald-600 text-white hover:bg-emerald-700"
          : style === "op"
            ? "bg-emerald-600/15 text-emerald-700 hover:bg-emerald-600/25 dark:text-emerald-400"
            : style === "fn"
              ? "bg-zinc-200 text-xs text-zinc-700 hover:bg-zinc-300 sm:text-sm dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"
              : style === "mem"
                ? "bg-transparent text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                : "bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
      } ${extra}`}
    >
      {label}
    </button>
  );

  return (
    <div
      ref={boxRef}
      tabIndex={0}
      onKeyDown={(e) => {
        const pressed = keyFromKeyboard(e);
        if (!pressed || e.ctrlKey || e.metaKey || e.altKey) return;
        e.preventDefault();
        press(pressed);
      }}
      onPaste={(e) => {
        if (!canUse) return;
        const text = e.clipboardData.getData("text").trim().replace(/-/g, "−").replace(/\*/g, "×").replace(/\//g, "÷");
        if (!text || !/^[0-9a-zA-Z.,+\-−×÷^()%! π√]*$/.test(text)) return;
        e.preventDefault();
        const next = `${fresh ? "" : tool.expr}${text}`;
        if (next.length <= 200) roomTools.calcSet(tool.id, next);
      }}
      className="relative flex h-full w-full gap-2 overflow-hidden outline-none"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {/* The display. */}
        <div className="flex shrink-0 flex-col items-end gap-0.5 rounded-lg bg-zinc-900 px-3 py-2 text-white">
          <div className="flex w-full items-center gap-1.5 text-[10px] font-semibold uppercase text-zinc-400">
            <button
              type="button"
              disabled={!canUse}
              onClick={() => roomTools.calcAngle(tool.id, tool.angle === "deg" ? "rad" : "deg")}
              title={t("roomTools.calc.angleHint")}
              className="rounded bg-white/10 px-1.5 py-0.5 hover:bg-white/20 disabled:hover:bg-white/10"
            >
              {tool.angle === "deg" ? "DEG" : "RAD"}
            </button>
            {tool.memory !== 0 && (
              <span title={formatNumber(tool.memory)} className="rounded bg-amber-500/20 px-1.5 py-0.5 text-amber-300">
                M
              </span>
            )}
            <span className="flex-1" />
            <button
              type="button"
              onClick={() => void copy()}
              title={t("roomTools.calc.copy")}
              aria-label={t("roomTools.calc.copy")}
              className="rounded p-0.5 hover:bg-white/10"
            >
              {copied ? <span className="normal-case">{t("roomTools.calc.copied")}</span> : <MdContentCopy className="h-3.5 w-3.5" />}
            </button>
            {!tapeOpen && (
              <button
                type="button"
                onClick={() => setTapeOpen(true)}
                title={t("roomTools.calc.tape")}
                aria-label={t("roomTools.calc.tape")}
                className="rounded p-0.5 hover:bg-white/10"
              >
                <MdHistory className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {fresh && tool.history[0] && (
            <div className="max-w-full truncate text-xs text-zinc-400" dir="ltr">
              {tool.history[0].expr} =
            </div>
          )}
          <div className="max-w-full overflow-x-auto whitespace-nowrap text-right text-2xl font-semibold tabular-nums sm:text-3xl" dir="ltr">
            {tool.expr || "0"}
          </div>
          <div className="h-4 max-w-full truncate text-right text-xs tabular-nums">
            {preview?.ok ? (
              <span className="text-zinc-400">= {formatNumber(preview.value)}</span>
            ) : preview && !preview.ok && preview.error === "math" ? (
              <span className="text-red-400">{t("roomTools.calc.mathError")}</span>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setScientific((v) => !v)}
            className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition ${
              scientific
                ? "bg-emerald-600/15 text-emerald-700 dark:text-emerald-400"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            {t("roomTools.calc.scientific")}
          </button>
          <span className="flex-1" />
          {(["MC", "MR", "M+", "M−"] as const).map((m) => (
            <button
              key={m}
              type="button"
              disabled={!canUse || ((m === "MC" || m === "MR") && tool.memory === 0)}
              onClick={() => {
                if (m === "MR") press("MR");
                else roomTools.calcMemory(tool.id, m === "MC" ? "clear" : m === "M+" ? "add" : "sub");
              }}
              title={t(`roomTools.calc.memory.${m === "MC" ? "clear" : m === "MR" ? "recall" : m === "M+" ? "add" : "sub"}`)}
              className="rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-zinc-600 hover:bg-zinc-100 disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              {m}
            </button>
          ))}
        </div>
        {/* The keypad: the scientific columns to the left of the basic ones. */}
        <div className={`grid min-h-0 flex-1 grid-rows-5 gap-1 ${scientific ? "grid-cols-7" : "grid-cols-4"}`}>
          {scientific
            ? [
                ["sin", "cos", "tan"],
                ["asin", "acos", "atan"],
                ["ln", "log", "e"],
                ["√", "^", "^2"],
                ["(", ")", "π"],
              ].flatMap((row, r) => [
                ...row.map((k) =>
                  key(
                    k === "^2" ? "x²" : k === "^" ? "xʸ" : k === "asin" ? "sin⁻¹" : k === "acos" ? "cos⁻¹" : k === "atan" ? "tan⁻¹" : k,
                    k,
                    "fn"
                  )
                ),
                ...basicRow(r),
              ])
            : [0, 1, 2, 3, 4].flatMap((r) => basicRow(r))}
        </div>
      </div>
      {tapeOpen && (
        <aside
          className={`flex min-h-0 flex-col overflow-hidden bg-white dark:bg-zinc-900 ${
            narrow ? "absolute inset-0 z-20 rounded-lg border border-zinc-200 p-2 dark:border-zinc-800" : "w-56 shrink-0 border-l border-zinc-200 pl-2 dark:border-zinc-800"
          }`}
        >
          <div className="flex shrink-0 items-center gap-1 pb-1.5">
            <MdHistory className="h-4 w-4 text-zinc-500" />
            <h4 className="flex-1 text-xs font-semibold text-zinc-700 dark:text-zinc-300">{t("roomTools.calc.tape")}</h4>
            {isManager && tool.history.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(t("roomTools.calc.clearTapeQuestion"))) roomTools.calcClearHistory(tool.id);
                }}
                title={t("roomTools.calc.clearTape")}
                aria-label={t("roomTools.calc.clearTape")}
                className="rounded p-0.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <MdDeleteSweep className="h-4 w-4" />
              </button>
            )}
            {narrow && (
              <button
                type="button"
                onClick={() => setTapeOpen(false)}
                aria-label={t("roomTools.calc.backToKeypad")}
                className="rounded p-0.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <MdClose className="h-4 w-4" />
              </button>
            )}
          </div>
          {tool.history.length === 0 ? (
            <p className="text-xs text-zinc-500">{t("roomTools.calc.emptyTape")}</p>
          ) : (
            <ol className="min-h-0 flex-1 overflow-y-auto">
              {tool.history.map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    disabled={!canUse}
                    onClick={() => {
                      const value = entry.result.replace(/^-/, "−");
                      const next = fresh || !tool.expr ? value : `${tool.expr}${value}`;
                      if (next.length <= 200) roomTools.calcSet(tool.id, next);
                      if (narrow) setTapeOpen(false);
                    }}
                    title={t("roomTools.calc.useResult")}
                    className="flex w-full flex-col items-end rounded-md px-1.5 py-1 text-right hover:bg-zinc-100 disabled:hover:bg-transparent dark:hover:bg-zinc-800"
                  >
                    <span className="max-w-full truncate text-[11px] text-zinc-500" dir="ltr">
                      {entry.expr} =
                    </span>
                    <span className="max-w-full truncate text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100" dir="ltr">
                      {entry.result}
                    </span>
                    <span className="text-[10px] text-zinc-400">
                      {entry.byName} · {new Date(entry.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </aside>
      )}
    </div>
  );

  function basicRow(r: number): ReactNode[] {
    const rows: [ReactNode, string, "num" | "op" | "fn" | "eq"][][] = [
      [
        ["C", "C", "fn"],
        [<MdBackspace key="b" className="h-4 w-4" />, "⌫", "fn"],
        ["%", "%", "fn"],
        ["÷", "÷", "op"],
      ],
      [
        ["7", "7", "num"],
        ["8", "8", "num"],
        ["9", "9", "num"],
        ["×", "×", "op"],
      ],
      [
        ["4", "4", "num"],
        ["5", "5", "num"],
        ["6", "6", "num"],
        ["−", "−", "op"],
      ],
      [
        ["1", "1", "num"],
        ["2", "2", "num"],
        ["3", "3", "num"],
        ["+", "+", "op"],
      ],
      [
        [scientific ? "ans" : "±", scientific ? "ans" : "±", "num"],
        ["0", "0", "num"],
        [",", ".", "num"],
        ["=", "=", "eq"],
      ],
    ];
    return rows[r].map(([label, value, style]) => key(label, value, style));
  }
}
