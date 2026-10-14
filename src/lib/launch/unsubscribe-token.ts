import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { isUuid } from "./guard";

/**
 * The one-click unsubscribe token carried by every list email.
 *
 * The waitlist row id is the browser's proof of ownership for reading and
 * editing its answers, so it never travels in an email link in the clear.
 * Instead the id is sealed with AES-256-GCM under a server secret: the token
 * is unguessable, a forged or edited token fails authentication, and the id
 * cannot be read out of it. The email address is never part of the token.
 *
 * Format: base64url(iv[12] | ciphertext[36] | tag[16]).
 */

const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_LABEL = "enquiry-waitlist-unsubscribe-v1";

function keyFor(secret: string): Buffer {
  return createHash("sha256").update(`${KEY_LABEL}:${secret}`).digest();
}

export function sealUnsubscribeToken(waitlistId: string, secret: string): string {
  if (!secret) throw new Error("unsubscribe secret is not set");
  if (!isUuid(waitlistId)) throw new Error("not a waitlist id");
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", keyFor(secret), iv);
  cipher.setAAD(Buffer.from(KEY_LABEL));
  const body = Buffer.concat([cipher.update(waitlistId, "utf8"), cipher.final()]);
  return Buffer.concat([iv, body, cipher.getAuthTag()]).toString("base64url");
}

/** The waitlist id inside a genuine token, or null for anything forged, edited or malformed. */
export function openUnsubscribeToken(token: string, secret: string): string | null {
  if (!secret || typeof token !== "string" || token.length > 200) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(token)) return null;
  const raw = Buffer.from(token, "base64url");
  if (raw.length <= IV_BYTES + TAG_BYTES) return null;
  // Reject non-canonical spellings of the same bytes, so one token has one form.
  if (raw.toString("base64url") !== token) return null;
  try {
    const iv = raw.subarray(0, IV_BYTES);
    const tag = raw.subarray(raw.length - TAG_BYTES);
    const body = raw.subarray(IV_BYTES, raw.length - TAG_BYTES);
    const decipher = createDecipheriv("aes-256-gcm", keyFor(secret), iv);
    decipher.setAAD(Buffer.from(KEY_LABEL));
    decipher.setAuthTag(tag);
    const id = Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
    return isUuid(id) ? id : null;
  } catch {
    // GCM authentication failed: the token was forged, edited or sealed under another secret.
    return null;
  }
}
