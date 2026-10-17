import { wheelSpinStart, type WheelEntry, type WheelSpin, type WheelTool } from "./roomTools";

// The room's wheel, drawn: where it is at a moment of a spin, and what is on
// it. Shared by its tile (components/roomTools/WheelView) and the
// picture-in-picture (canvasPip), so both show the same turn.

/** How long after it stops the wheel keeps the slices it spun with — the winner's, too. */
export const WHEEL_RESULT_MS = 6_000;

function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

/** Where the wheel is at `now` (performance.now()), in degrees clockwise, and how far through the spin. */
export function wheelAngle(tool: WheelTool, now: number): { angle: number; progress: number; sinceEnd: number } {
  const spin = tool.spin;
  if (!spin) return { angle: 0, progress: 1, sinceEnd: Infinity };
  const elapsed = now - wheelSpinStart(spin);
  const progress = Math.min(1, Math.max(0, elapsed / spin.duration));
  return { angle: spin.from + (spin.to - spin.from) * easeOut(progress), progress, sinceEnd: elapsed - spin.duration };
}

/**
 * What is on the wheel at `now`: the entries the spin started with while it
 * turns and for a while after (the winner may have left the list), the list
 * as it is otherwise.
 */
export function wheelEntriesAt(tool: WheelTool, now: number): WheelEntry[] {
  const spin = tool.spin;
  if (spin && now - wheelSpinStart(spin) < spin.duration + WHEEL_RESULT_MS) return spin.entries;
  return tool.entries;
}

export function isSpinning(spin: WheelSpin | null, now: number): boolean {
  return Boolean(spin && now - wheelSpinStart(spin) < spin.duration);
}

/** Each entry's slice, in degrees clockwise from the top. */
export function wheelSlices(entries: WheelEntry[]): { entry: WheelEntry; start: number; end: number }[] {
  const total = entries.reduce((sum, e) => sum + e.weight, 0) || 1;
  let at = 0;
  return entries.map((entry) => {
    const start = (at / total) * 360;
    at += entry.weight;
    return { entry, start, end: (at / total) * 360 };
  });
}

/** Which slice is under the pointer (at the top) with the wheel turned `angle` degrees. */
export function sliceUnderPointer(entries: WheelEntry[], angle: number): number {
  if (entries.length === 0) return -1;
  const at = (((-angle % 360) + 360) % 360);
  const slices = wheelSlices(entries);
  const index = slices.findIndex((s) => at >= s.start && at < s.end);
  return index >= 0 ? index : slices.length - 1;
}

/** Black or white, whichever reads on `hex`. */
export function textOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return r * 0.299 + g * 0.587 + b * 0.114 > 160 ? "#18181b" : "#ffffff";
}

export function shortLabel(text: string, count: number): string {
  const max = count > 40 ? 10 : count > 20 ? 14 : 20;
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Draws the wheel on a canvas, centered in `width`×`height` — for the picture-in-picture. */
export function drawWheel(ctx: CanvasRenderingContext2D, tool: WheelTool, width: number, height: number, textColor: string) {
  const now = performance.now();
  const entries = wheelEntriesAt(tool, now);
  const { angle, progress, sinceEnd } = wheelAngle(tool, now);
  const radius = Math.min(width, height) / 2 - 24;
  const cx = width / 2;
  const cy = height / 2 + 8;
  if (entries.length === 0) {
    ctx.fillStyle = textColor;
    ctx.font = "16px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(tool.title, cx, cy);
    return;
  }
  const rad = (deg: number) => ((deg - 90) * Math.PI) / 180;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((angle * Math.PI) / 180);
  for (const { entry, start, end } of wheelSlices(entries)) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius, rad(start), rad(end));
    ctx.closePath();
    ctx.fillStyle = entry.color;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.save();
    ctx.rotate(rad((start + end) / 2));
    ctx.fillStyle = textOn(entry.color);
    ctx.font = `600 ${Math.max(9, Math.min(18, (radius * 2.2) / Math.max(entries.length, 6)))}px system-ui, sans-serif`;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(shortLabel(entry.text, entries.length), radius - 10, 0);
    ctx.restore();
  }
  ctx.restore();
  // The hub and the pointer.
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.12, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - 12, cy - radius - 14);
  ctx.lineTo(cx + 12, cy - radius - 14);
  ctx.lineTo(cx, cy - radius + 8);
  ctx.closePath();
  ctx.fillStyle = "#18181b";
  ctx.fill();
  // The result, once it stopped.
  if (tool.spin && progress >= 1 && sinceEnd < WHEEL_RESULT_MS) {
    const label = `🎉 ${tool.spin.winnerText}`;
    ctx.font = "700 20px system-ui, sans-serif";
    const w = Math.min(width - 20, ctx.measureText(label).width + 28);
    ctx.fillStyle = "rgba(0,0,0,0.75)";
    ctx.fillRect(cx - w / 2, height - 44, w, 34);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, cx, height - 27, width - 30);
  }
}
