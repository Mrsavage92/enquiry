import type { VoiceProfile } from "./types";

/** Rewrite greeting and sign-off. Leaves the commercial body alone. */
export function applyVoiceToDraft(
  body: string,
  voice: VoiceProfile,
  firstName: string,
): string {
  const greeting = voice.greeting.replace(/\{name\}/g, firstName);
  const lines = body.replace(/\s+$/, "").split("\n");
  if (lines[0] && /^(hi|hello|hey|dear)\b/i.test(lines[0]!.trim())) {
    lines[0] = greeting;
  }
  let lastBody = lines.length - 1;
  while (
    lastBody >= 1 &&
    lines[lastBody]!.trim().length > 0 &&
    lines[lastBody]!.length < 48 &&
    !/[.?!]$/.test(lines[lastBody]!.trim())
  ) {
    lastBody -= 1;
  }
  const head = lines
    .slice(0, lastBody + 1)
    .join("\n")
    .replace(/\s+$/, "");
  return `${head}\n\n${voice.signOff}`;
}
