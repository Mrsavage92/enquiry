import type { VoiceProfile } from "./types";

export type VoiceProposal = {
  patch: Partial<VoiceProfile>;
  from: string;
  to: string;
  reason: string;
};

export type DollarMatch = { raw: string; amount: number };

export function dollarMatches(text: string): DollarMatch[] {
  return [...text.matchAll(/\$[\d,]+(?:\.\d{2})?/g)].map((m) => ({
    raw: m[0],
    amount: Number(m[0].replace(/[$,]/g, "")),
  }));
}

export function dollarAmounts(text: string): number[] {
  return dollarMatches(text).map((m) => m.amount);
}

function fmtDollar(n: number): string {
  return `$${n.toLocaleString("en-AU")}`;
}

export function detectPriceDrift(
  original: string,
  edited: string,
): { from: string; to: string } | null {
  const a = dollarAmounts(original);
  const b = dollarAmounts(edited);
  if (a.join(",") === b.join(",")) return null;
  const from = a.filter((n) => !b.includes(n));
  const to = b.filter((n) => !a.includes(n));
  if (from.length === 0 && to.length === 0) return null;
  return {
    from: from.map(fmtDollar).join(", ") || "none",
    to: to.map(fmtDollar).join(", ") || "none",
  };
}

/** True when the letter almost-but-not names the sheet figure (the $187 / $188 bug). */
export function detectSheetLetterMismatch(
  letter: string,
  sheet: { total?: number; hold?: number },
): { sheet: string; letter: string } | null {
  const dollars = dollarAmounts(letter);
  if (dollars.length === 0) return null;
  const near = (target?: number) =>
    target == null ? undefined : dollars.find((d) => d !== target && Math.abs(d - target) <= 5);
  const holdMiss = near(sheet.hold);
  if (holdMiss != null && sheet.hold != null) {
    return { sheet: fmtDollar(sheet.hold), letter: fmtDollar(holdMiss) };
  }
  const totalMiss = near(sheet.total);
  if (totalMiss != null && sheet.total != null) {
    return { sheet: fmtDollar(sheet.total), letter: fmtDollar(totalMiss) };
  }
  return null;
}

export function alignLetterToSheet(
  letter: string,
  sheet: { total?: number; hold?: number },
): string {
  let next = letter;
  for (const m of dollarMatches(letter)) {
    const target =
      sheet.hold != null && m.amount !== sheet.hold && Math.abs(m.amount - sheet.hold) <= 5
        ? sheet.hold
        : sheet.total != null && m.amount !== sheet.total && Math.abs(m.amount - sheet.total) <= 5
          ? sheet.total
          : null;
    if (target == null) continue;
    next = next.replace(m.raw, fmtDollar(target));
  }
  return next;
}

function firstLine(body: string) {
  return body.trimStart().split("\n")[0]?.trim() ?? "";
}

function extractSignOff(body: string): string {
  const lines = body.replace(/\s+$/, "").split("\n");
  let lastBody = lines.length - 1;
  while (
    lastBody >= 1 &&
    lines[lastBody]!.trim().length > 0 &&
    lines[lastBody]!.length < 48 &&
    !/[.?!]$/.test(lines[lastBody]!.trim())
  ) {
    lastBody -= 1;
  }
  return lines
    .slice(lastBody + 1)
    .join("\n")
    .trim();
}

function greetingTemplate(line: string, firstName: string): { greeting: string; warmth?: string } | null {
  if (!line || line.length > 60) return null;
  const escaped = firstName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const nameRe = new RegExp(escaped, "i");
  const templated = line.replace(nameRe, "{name}");
  if (/^hello\b/i.test(line)) {
    return { greeting: templated.includes("{name}") ? templated : "Hello {name},", warmth: "Reserved" };
  }
  if (/^hi\b/i.test(line)) {
    return { greeting: templated.includes("{name}") ? templated : "Hi {name},", warmth: "Warm" };
  }
  if (/^hey\b/i.test(line)) {
    return { greeting: templated.includes("{name}") ? templated : "Hey {name},", warmth: "Warm" };
  }
  if (nameRe.test(line)) {
    return { greeting: templated, warmth: "Reserved" };
  }
  return null;
}

export function detectVoiceEdit(
  original: string,
  edited: string,
  voice: VoiceProfile,
  firstName: string,
): VoiceProposal | null {
  if (original.trim() === edited.trim()) return null;

  const origG = firstLine(original);
  const newG = firstLine(edited);
  const origS = extractSignOff(original);
  const newS = extractSignOff(edited);

  const patch: Partial<VoiceProfile> = {};
  const bits: string[] = [];
  let from = "";
  let to = "";

  if (origG !== newG) {
    const parsed = greetingTemplate(newG, firstName);
    if (parsed && parsed.greeting !== voice.greeting) {
      patch.greeting = parsed.greeting;
      if (parsed.warmth && parsed.warmth !== voice.warmth) patch.warmth = parsed.warmth;
      bits.push("greeting");
      from = origG;
      to = newG;
    }
  }

  if (newS && newS !== origS && newS !== voice.signOff) {
    patch.signOff = newS;
    bits.push("sign-off");
    if (!from) {
      from = origS;
      to = newS;
    } else {
      from = `${from} · ${origS}`;
      to = `${to} · ${newS}`;
    }
  }

  if (bits.length === 0) return null;

  return {
    patch,
    from,
    to,
    reason:
      bits.length === 2
        ? "You changed the greeting and sign-off."
        : bits[0] === "greeting"
          ? "You changed the greeting."
          : "You changed the sign-off.",
  };
}
