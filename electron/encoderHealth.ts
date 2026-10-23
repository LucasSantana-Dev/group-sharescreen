// Whether this machine's hardware H.264 encoder is known to wedge.
//
// golive-videocap tells us (see lib/encoderStall.ts): the encoder accepted a
// frame and never produced one. Chromium's own WebRTC encoder runs on the same
// hardware, and on that machine it wedges too, and then closing the share's
// RTCPeerConnection blocks the renderer's main thread until the app is killed
// (pc.close() waits on WebRTC's worker thread, which waits on the encoder).
// Nothing in the page can unblock that once it has started.
//
// What can be done is not starting it: the next run sets Chromium's
// --disable-accelerated-video-encode before the app is ready, so WebRTC
// encodes in software, and skips the helper, whose encoder would only stall
// again. The marker expires, and is dropped by a new Electron, so a driver
// update or a Chromium fix gets its chance without anyone finding this file.

import { app } from "electron";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const MARKER_FILE = "hardware-encoder.json";
const MARKER_TTL_MS = 14 * 24 * 60 * 60_000;

interface Marker {
  wedgedAt: number;
  electron: string;
}

function markerPath(): string {
  return path.join(app.getPath("userData"), MARKER_FILE);
}

let wedged: boolean | null = null;

/** Read once: it has to be answered before the app is ready, and does not change mid-run. */
export function hardwareEncoderWedged(): boolean {
  if (wedged !== null) return wedged;
  wedged = false;
  try {
    const marker = JSON.parse(readFileSync(markerPath(), "utf8")) as Partial<Marker>;
    wedged =
      typeof marker.wedgedAt === "number" &&
      Date.now() - marker.wedgedAt < MARKER_TTL_MS &&
      marker.electron === process.versions.electron;
  } catch {
    // No file (the common case) or a damaged one: the hardware gets its turn.
  }
  return wedged;
}

/**
 * Remembers a wedge for the next run. This run keeps its switches, which
 * cannot change once Chromium is up; the share in progress falls back to
 * Chromium's capture as before.
 */
export function rememberHardwareEncoderWedged(): void {
  const marker: Marker = { wedgedAt: Date.now(), electron: process.versions.electron };
  try {
    writeFileSync(markerPath(), `${JSON.stringify(marker, null, 2)}\n`, "utf8");
  } catch {
    // A read-only or full disk: the next run tries the hardware again.
  }
}
