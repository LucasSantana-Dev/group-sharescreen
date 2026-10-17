// The room's calculator: what an expression comes to. The site works it out
// as it is typed (the preview under the display); the API works it out again
// when somebody presses "=", and that is the result that goes in the tape.
// The same file on both sides (the API's server/calc.ts) — keep them equal.
//
// A small parser of its own, never eval: + − × ÷ ^, parentheses, % (a
// hundredth), ! (factorial), functions (sqrt, sin, log…), the constants pi
// and e, `ans` (the last result) and implicit multiplication — 2pi, 3(4+1).

export type AngleMode = "deg" | "rad";
export type CalcResult = { ok: true; value: number } | { ok: false; error: "syntax" | "math" };

export const MAX_CALC_EXPR = 200;

const FUNCTIONS: Record<string, (x: number, mode: AngleMode) => number> = {
  sqrt: (x) => Math.sqrt(x),
  cbrt: (x) => Math.cbrt(x),
  sin: (x, m) => Math.sin(toRad(x, m)),
  cos: (x, m) => Math.cos(toRad(x, m)),
  tan: (x, m) => Math.tan(toRad(x, m)),
  asin: (x, m) => fromRad(Math.asin(x), m),
  acos: (x, m) => fromRad(Math.acos(x), m),
  atan: (x, m) => fromRad(Math.atan(x), m),
  log: (x) => Math.log10(x),
  ln: (x) => Math.log(x),
  exp: (x) => Math.exp(x),
  abs: (x) => Math.abs(x),
  round: (x) => Math.round(x),
  floor: (x) => Math.floor(x),
  ceil: (x) => Math.ceil(x),
};

function toRad(x: number, mode: AngleMode): number {
  return mode === "deg" ? (x * Math.PI) / 180 : x;
}

function fromRad(x: number, mode: AngleMode): number {
  return mode === "deg" ? (x * 180) / Math.PI : x;
}

/** sin(30) in degrees is ½, not 0.49999999999999994. */
function tidy(x: number): number {
  return Math.abs(x) < 1e-12 ? 0 : Number.parseFloat(x.toPrecision(14));
}

type Token = { t: "num"; v: number } | { t: "id"; v: string } | { t: "op"; v: string };

function tokenize(input: string): Token[] | null {
  const src = input
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/[−–]/g, "-")
    .replace(/π/g, "pi")
    .replace(/√/g, "sqrt")
    .replace(/,/g, ".");
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === " ") {
      i += 1;
    } else if (/[0-9.]/.test(c)) {
      const match = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(src.slice(i));
      if (!match) return null;
      tokens.push({ t: "num", v: Number(match[0]) });
      i += match[0].length;
    } else if (/[a-z]/i.test(c)) {
      const match = /^[a-z]+/i.exec(src.slice(i))!;
      tokens.push({ t: "id", v: match[0].toLowerCase() });
      i += match[0].length;
    } else if ("+-*/^()%!".includes(c)) {
      tokens.push({ t: "op", v: c });
      i += 1;
    } else {
      return null;
    }
  }
  return tokens;
}

function factorial(n: number): number {
  if (!Number.isInteger(n) || n < 0 || n > 170) return NaN;
  let out = 1;
  for (let k = 2; k <= n; k++) out *= k;
  return out;
}

/** What `expr` comes to, with `ans` the last result. */
export function evaluate(expr: string, options: { mode: AngleMode; ans: number }): CalcResult {
  if (expr.length > MAX_CALC_EXPR) return { ok: false, error: "syntax" };
  const parsed = tokenize(expr);
  if (!parsed || parsed.length === 0) return { ok: false, error: "syntax" };
  const tokens = parsed;
  let pos = 0;
  let depth = 0;
  const peek = () => tokens[pos];
  const isOp = (v: string) => peek()?.t === "op" && peek()!.v === v;
  const fail = (): never => {
    throw new SyntaxError();
  };

  function expression(): number {
    let value = term();
    while (isOp("+") || isOp("-")) {
      const op = tokens[pos++].v;
      const right = term();
      value = op === "+" ? value + right : value - right;
    }
    return value;
  }

  function term(): number {
    let value = unary();
    for (;;) {
      if (isOp("*") || isOp("/")) {
        const op = tokens[pos++].v;
        const right = unary();
        value = op === "*" ? value * right : value / right;
      } else if (peek() && (peek()!.t !== "op" || peek()!.v === "(")) {
        // 2pi, 3(4+1), (1+1)(2+2)
        value *= power();
      } else {
        return value;
      }
    }
  }

  function unary(): number {
    if (isOp("-")) {
      pos += 1;
      return -unary();
    }
    if (isOp("+")) {
      pos += 1;
      return unary();
    }
    return power();
  }

  function power(): number {
    const base = postfix();
    if (isOp("^")) {
      pos += 1;
      return Math.pow(base, unary());
    }
    return base;
  }

  function postfix(): number {
    let value = primary();
    while (isOp("%") || isOp("!")) {
      value = tokens[pos++].v === "%" ? value / 100 : factorial(value);
    }
    return value;
  }

  function primary(): number {
    const token = tokens[pos++];
    if (!token) return fail();
    if (token.t === "num") return token.v;
    if (token.t === "op") {
      if (token.v !== "(") return fail();
      if (++depth > 50) return fail();
      const value = expression();
      // A missing ")" at the very end is forgiven, as on a pocket calculator.
      if (isOp(")")) pos += 1;
      else if (pos < tokens.length) return fail();
      depth -= 1;
      return value;
    }
    if (token.v === "pi") return Math.PI;
    if (token.v === "e") return Math.E;
    if (token.v === "ans") return options.ans;
    const fn = FUNCTIONS[token.v];
    if (!fn) return fail();
    // sqrt 9 as well as sqrt(9).
    const arg = isOp("(") ? primary() : power();
    return fn(arg, options.mode);
  }

  try {
    const value = expression();
    if (pos < tokens.length) return { ok: false, error: "syntax" };
    if (!Number.isFinite(value)) return { ok: false, error: "math" };
    return { ok: true, value: tidy(value) };
  } catch {
    return { ok: false, error: "syntax" };
  }
}

/** A result as the display shows it: no float noise, exponent only when it must. */
export function formatNumber(value: number): string {
  if (Object.is(value, -0) || value === 0) return "0";
  const abs = Math.abs(value);
  if (abs >= 1e15 || abs < 1e-9) return value.toExponential(8).replace(/\.?0+e/, "e");
  return String(Number.parseFloat(value.toPrecision(14)));
}
