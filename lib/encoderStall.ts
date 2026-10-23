// What golive-videocap's STALL line says about the hardware H.264 encoder.
//
// The helper prints it once when nothing has come out of the encoder a few
// seconds into a share (see WatchProgress in electron/native/src/videocap.cpp).
// Most of the time that is the capture's fault: no frames arrived, or the
// encoder refused them. One case is the encoder's own: it accepted input and
// never produced anything. On the machines where that happens (seen on an AMD
// RX 9070 XT), Chromium's own WebRTC encoder, which drives the same hardware,
// wedges the same way, and an RTCPeerConnection.close() on that share then
// blocks the renderer for good. The shell remembers it (see
// electron/encoderHealth.ts) so the next run stays off that encoder.

const STALL = /^STALL arrived=(\d+) converted=(\d+) needInput=(\d+) accepted=(\d+) refused=(\d+)/;

/** Whether a helper line reports an encoder that took input and never answered. */
export function isWedgedEncoderStall(line: string): boolean {
  const match = STALL.exec(line.trim());
  if (!match) return false;
  const accepted = Number(match[4]);
  const refused = Number(match[5]);
  return accepted > 0 && refused === 0;
}
