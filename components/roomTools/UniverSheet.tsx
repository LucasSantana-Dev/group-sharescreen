"use client";

import { useEffect, useRef } from "react";
import { createUniver, LocaleType, mergeLocales } from "@univerjs/presets";
import { UniverSheetsCorePreset } from "@univerjs/preset-sheets-core";
import UniverPresetSheetsCoreEnUS from "@univerjs/preset-sheets-core/locales/en-US";
import "@univerjs/preset-sheets-core/lib/index.css";
import { roomTools, type SheetTool } from "@/lib/roomTools";
import {
  MAX_CELL_LENGTH,
  MAX_SHEET_COLS,
  MAX_SHEET_ROWS,
  cellKey,
  type CellAlign,
  type CellStyle,
  type SheetCell,
  type SheetChange,
  type SheetData,
} from "@/lib/sheet";
import { markFeatureUsed } from "@/components/NewBadge";
import { UNIVER_SHEET_FEATURE } from "@/lib/clipsMode";

// The room's spreadsheet drawn by Univer — a full Excel-like grid (formulas,
// formatting, fill handle, Excel shortcuts) — for whoever is in the
// room-sheet-univer experiment and turned it on (see SheetView). Loaded only
// then, through next/dynamic: it is a few MB.
//
// The sheet still belongs to lib/roomTools: Univer is only a view of it.
//   - out: after Univer changes something, its snapshot is compared with the
//     last model this view saw, and the difference goes out as SheetChanges
//     (set, style, size, width) — the same ones the classic grid sends;
//   - in: a model that changed elsewhere is compared with the previous model,
//     and only those cells are written into Univer, so whatever is being typed
//     here and not yet sent is not overwritten.
// What the model cannot hold (borders, merges, number formats, more sheets)
// stays in this browser only.

// Univer's horizontal alignment: 1 left, 2 center, 3 right.
const ALIGN_TO_UNIVER: Record<CellAlign, number> = { left: 1, center: 2, right: 3 };
const UNIVER_TO_ALIGN: Record<number, CellAlign> = { 1: "left", 2: "center", 3: "right" };

type UniverStyle = { bl?: number; it?: number; bg?: { rgb?: string }; cl?: { rgb?: string }; ht?: number };
type UniverCell = { v?: string | number | boolean | null; f?: string | null; s?: string | UniverStyle | null };
type UniverSheetData = {
  rowCount?: number;
  columnCount?: number;
  cellData?: Record<string, Record<string, UniverCell>>;
  columnData?: Record<string, { w?: number }>;
};
type UniverWorkbookData = { styles?: Record<string, UniverStyle>; sheets?: Record<string, UniverSheetData>; sheetOrder?: string[] };

// Univer's public API, only as far as this file uses it.
type FRange = {
  setValue(value: string | number): unknown;
  setFontWeight(weight: "bold" | null): unknown;
  setFontStyle(style: "italic" | null): unknown;
  setBackgroundColor(color: string | null): unknown;
  setFontColor(color: string | null): unknown;
  setHorizontalAlignment(alignment: "left" | "center" | "normal" | "right"): unknown;
};
type FWorksheet = {
  getRange(row: number, col: number): FRange;
  setColumnWidth(col: number, width: number): unknown;
};
type FWorkbook = { save(): UniverWorkbookData; getActiveSheet(): FWorksheet };
type UniverAPI = {
  createWorkbook(data: unknown): FWorkbook;
  addEvent(event: unknown, cb: (event: { id?: string; type?: number }) => void): { dispose(): void };
  Event: { CommandExecuted: unknown };
  dispose(): void;
};

/** The cell as the model keeps it, from Univer's. */
function fromUniver(cell: UniverCell | undefined, styles: Record<string, UniverStyle>): SheetCell | null {
  if (!cell) return null;
  const s = typeof cell.s === "string" ? styles[cell.s] : cell.s ?? undefined;
  const v = cell.f ? cell.f : cell.v === null || cell.v === undefined ? "" : String(cell.v);
  const out: SheetCell = { v: v.slice(0, MAX_CELL_LENGTH) };
  if (s?.bl) out.b = true;
  if (s?.it) out.i = true;
  if (s?.bg?.rgb) out.bg = s.bg.rgb;
  if (s?.cl?.rgb) out.color = s.cl.rgb;
  if (s?.ht && UNIVER_TO_ALIGN[s.ht]) out.align = UNIVER_TO_ALIGN[s.ht];
  return out.v || out.b || out.i || out.bg || out.color || out.align ? out : null;
}

function toUniver(cell: SheetCell): UniverCell {
  const s: UniverStyle = {};
  if (cell.b) s.bl = 1;
  if (cell.i) s.it = 1;
  if (cell.bg) s.bg = { rgb: cell.bg };
  if (cell.color) s.cl = { rgb: cell.color };
  if (cell.align) s.ht = ALIGN_TO_UNIVER[cell.align];
  const out: UniverCell = cell.v.startsWith("=") ? { f: cell.v } : { v: cell.v };
  if (Object.keys(s).length) out.s = s;
  return out;
}

function workbookOf(sheet: SheetData, title: string) {
  const cellData: Record<number, Record<number, UniverCell>> = {};
  for (const [key, cell] of Object.entries(sheet.cells)) {
    const [r, c] = key.split(",").map(Number);
    (cellData[r] ??= {})[c] = toUniver(cell);
  }
  const columnData: Record<number, { w: number }> = {};
  for (const [col, w] of Object.entries(sheet.colWidths)) columnData[Number(col)] = { w };
  return {
    id: "room-sheet",
    sheetOrder: ["sheet"],
    sheets: { sheet: { id: "sheet", name: title || "Sheet1", rowCount: sheet.rows, columnCount: sheet.cols, cellData, columnData } },
  };
}

const STYLE_FIELDS = ["b", "i", "bg", "color", "align"] as const;

/** What it takes to turn `from` into `to`, as the changes the model knows. */
function diffSheets(from: SheetData, to: SheetData): SheetChange[] {
  const changes: SheetChange[] = [];
  if (from.rows !== to.rows || from.cols !== to.cols) changes.push({ op: "size", rows: to.rows, cols: to.cols });
  const keys = new Set([...Object.keys(from.cells), ...Object.keys(to.cells)]);
  // Cells sharing the same style change go out together.
  const styleGroups = new Map<string, { style: CellStyle; cells: string[] }>();
  for (const key of keys) {
    const a = from.cells[key];
    const b = to.cells[key];
    if ((a?.v ?? "") !== (b?.v ?? "")) changes.push({ op: "set", cell: key, v: b?.v ?? "" });
    const style: CellStyle = {};
    let changed = false;
    for (const field of STYLE_FIELDS) {
      if ((a?.[field] ?? null) === (b?.[field] ?? null)) continue;
      (style as Record<string, unknown>)[field] = b?.[field] ?? null;
      changed = true;
    }
    if (!changed) continue;
    const id = JSON.stringify(style);
    const group = styleGroups.get(id);
    if (group) group.cells.push(key);
    else styleGroups.set(id, { style, cells: [key] });
  }
  for (const { style, cells } of styleGroups.values()) changes.push({ op: "style", cells, style });
  for (let col = 0; col < to.cols; col++) {
    const w = to.colWidths[col];
    if (w !== undefined && w !== from.colWidths[col]) changes.push({ op: "width", col, width: w });
  }
  return changes;
}

function snapshotOf(api: FWorkbook, fallback: SheetData): SheetData {
  const data = api.save();
  const id = data.sheetOrder?.[0];
  const sheet = id ? data.sheets?.[id] : undefined;
  if (!sheet) return fallback;
  const styles = data.styles ?? {};
  const rows = Math.min(MAX_SHEET_ROWS, Math.max(1, sheet.rowCount ?? fallback.rows));
  const cols = Math.min(MAX_SHEET_COLS, Math.max(1, sheet.columnCount ?? fallback.cols));
  const cells: Record<string, SheetCell> = {};
  for (const [r, line] of Object.entries(sheet.cellData ?? {})) {
    if (Number(r) >= rows) continue;
    for (const [c, raw] of Object.entries(line)) {
      if (Number(c) >= cols) continue;
      const cell = fromUniver(raw, styles);
      if (cell) cells[cellKey(Number(r), Number(c))] = cell;
    }
  }
  const colWidths: Record<string, number> = {};
  for (const [c, col] of Object.entries(sheet.columnData ?? {})) {
    if (Number(c) < cols && col.w) colWidths[c] = Math.round(col.w);
  }
  return { rows, cols, cells, colWidths };
}

function modelOf(tool: SheetTool): SheetData {
  return { rows: tool.rows, cols: tool.cols, cells: tool.cells, colWidths: tool.colWidths };
}

export default function UniverSheet({ tool, canUse }: { tool: SheetTool; canUse: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<UniverAPI | null>(null);
  const workbookRef = useRef<FWorkbook | null>(null);
  // The model as this view last saw it — what Univer is compared with.
  const seen = useRef<SheetData>(modelOf(tool));
  const applyingRemote = useRef(false);
  const toolRef = useRef(tool);
  useEffect(() => {
    toolRef.current = tool;
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const { univerAPI } = createUniver({
      locale: LocaleType.EN_US,
      locales: { [LocaleType.EN_US]: mergeLocales(UniverPresetSheetsCoreEnUS) },
      presets: [UniverSheetsCorePreset({ container, header: false, toolbar: canUse, footer: false })],
    }) as unknown as { univerAPI: UniverAPI };
    apiRef.current = univerAPI;
    const start = modelOf(toolRef.current);
    seen.current = start;
    workbookRef.current = univerAPI.createWorkbook(workbookOf(start, toolRef.current.title));

    let timer: number | undefined;
    let used = false;
    // Univer runs many commands per action; one look a moment after the last.
    const sub = univerAPI.addEvent(univerAPI.Event.CommandExecuted, () => {
      if (applyingRemote.current) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const book = workbookRef.current;
        if (!book) return;
        const now = snapshotOf(book, seen.current);
        const changes = diffSheets(seen.current, now);
        if (!changes.length) return;
        seen.current = now;
        if (!canUse) return;
        for (const change of changes) roomTools.editSheet(toolRef.current.id, change);
        if (!used) {
          used = true;
          markFeatureUsed(UNIVER_SHEET_FEATURE);
        }
      }, 120);
    });

    // Keys the room listens for (shortcuts) stay out of the sheet.
    const stop = (event: KeyboardEvent) => event.stopPropagation();
    container.addEventListener("keydown", stop);
    return () => {
      window.clearTimeout(timer);
      container.removeEventListener("keydown", stop);
      sub.dispose();
      univerAPI.dispose();
      apiRef.current = null;
      workbookRef.current = null;
    };
    // Univer is built once; read-only changes rebuild it.
  }, [canUse]);

  // Changes from elsewhere: only the cells that moved since the last model.
  useEffect(() => {
    const book = workbookRef.current;
    if (!book) return;
    const next = modelOf(tool);
    const changes = diffSheets(seen.current, next);
    seen.current = next;
    if (!changes.length) return;
    const sheet = book.getActiveSheet();
    applyingRemote.current = true;
    try {
      for (const change of changes) {
        if (change.op === "set") {
          const [r, c] = change.cell.split(",").map(Number);
          sheet.getRange(r, c).setValue(change.v);
        } else if (change.op === "style") {
          for (const key of change.cells) {
            const [r, c] = key.split(",").map(Number);
            const range = sheet.getRange(r, c);
            const s = change.style;
            if (s.b !== undefined) range.setFontWeight(s.b ? "bold" : null);
            if (s.i !== undefined) range.setFontStyle(s.i ? "italic" : null);
            if (s.bg !== undefined) range.setBackgroundColor(s.bg);
            if (s.color !== undefined) range.setFontColor(s.color);
            if (s.align !== undefined) range.setHorizontalAlignment(s.align ?? "normal");
          }
        } else if (change.op === "width") {
          sheet.setColumnWidth(change.col, change.width);
        }
      }
    } finally {
      // Univer's own follow-up commands land in the same tick.
      window.setTimeout(() => {
        applyingRemote.current = false;
      }, 0);
    }
  }, [tool]);

  return <div ref={containerRef} className="h-full w-full" />;
}
