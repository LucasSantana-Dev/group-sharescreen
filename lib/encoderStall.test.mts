// node --experimental-strip-types lib/encoderStall.test.mts
import assert from "node:assert/strict";
import test from "node:test";
import { isWedgedEncoderStall } from "./encoderStall";

test("an encoder that accepted input and produced nothing is wedged", () => {
  assert.equal(
    isWedgedEncoderStall("STALL arrived=128 converted=127 needInput=1 accepted=1 refused=0 lastInputError=0x00000000"),
    true
  );
});

test("a stall with nothing accepted is the capture's, not the encoder's", () => {
  assert.equal(isWedgedEncoderStall("STALL arrived=0 converted=0 needInput=1 accepted=0 refused=0 lastInputError=0x00000000"), false);
});

test("an encoder that refused input failed loudly and is not wedged", () => {
  assert.equal(isWedgedEncoderStall("STALL arrived=40 converted=40 needInput=3 accepted=2 refused=5 lastInputError=0x80004005"), false);
});

test("other helper lines are not stalls", () => {
  assert.equal(isWedgedEncoderStall("READY 1920 1080 AMD H.264 Encoder MFT"), false);
  assert.equal(isWedgedEncoderStall(""), false);
});
