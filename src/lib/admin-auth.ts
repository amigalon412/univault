import { createHmac, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Auth for the one admin page. Deliberately small: a single operator, a single
 * password, one thing to change.
 *
 * The threat here is not someone reading the $SAFEX address -- that is public
 * the moment it exists. It is someone WRITING it, because the site would then
 * vouch for a scam contract to everyone who copies the CA off the header. So
 * the password is never allowed to have a default, failures are throttled, and
 * the session cookie is signed rather than guessable.
 */

const COOKIE = "blur_admin";
const SESSION_SECONDS = 12 * 60 * 60;

/** Absent password means the admin surface is switched off entirely. */
export function adminPassword(): string | null {
  const raw = process.env.ADMIN_PASSWORD;
  return raw && raw.length >= 12 ? raw : null;
}

/**
 * Signing key for session cookies, derived from the password so that changing
 * the password logs every existing session out. ADMIN_SESSION_SECRET overrides
 * it if you would rather sessions survive a password rotation.
 */
function signingKey(password: string): Buffer {
  const override = process.env.ADMIN_SESSION_SECRET;
  return createHash("sha256")
    .update(override ? `s:${override}` : `p:${password}`)
    .digest();
}

function sign(value: string, password: string): string {
  return createHmac("sha256", signingKey(password)).update(value).digest("hex");
}

/** Compare without leaking how much of the input matched. */
function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function checkPassword(candidate: unknown): boolean {
  const expected = adminPassword();
  if (!expected || typeof candidate !== "string") return false;
  return safeEqual(candidate, expected);
}

/** Token is `expiry.nonce.hmac` — the nonce keeps two sessions distinct. */
function issue(password: string): { token: string; maxAge: number } {
  const exp = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const nonce = randomBytes(9).toString("hex");
  const body = `${exp}.${nonce}`;
  return { token: `${body}.${sign(body, password)}`, maxAge: SESSION_SECONDS };
}

function verify(token: string | undefined, password: string): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [expRaw, nonce, mac] = parts;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return false;
  return safeEqual(mac, sign(`${expRaw}.${nonce}`, password));
}

export async function startSession(): Promise<void> {
  const password = adminPassword();
  if (!password) return;
  const { token, maxAge } = issue(password);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).set(COOKIE, "", { path: "/", maxAge: 0 });
}

export async function isAuthed(): Promise<boolean> {
  const password = adminPassword();
  if (!password) return false;
  return verify((await cookies()).get(COOKIE)?.value, password);
}

/* ── Throttling ────────────────────────────────────────────────────────────
   In-memory, which is the right size for a single-process VPS deployment: it
   resets on restart, and restarting is not something an attacker can trigger.
   A distributed deploy would need this in a shared store instead. */

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 8;
const failures = new Map<string, { count: number; first: number }>();

export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

export function isThrottled(key: string): boolean {
  const entry = failures.get(key);
  if (!entry) return false;
  if (Date.now() - entry.first > WINDOW_MS) {
    failures.delete(key);
    return false;
  }
  return entry.count >= MAX_FAILURES;
}

export function noteFailure(key: string): void {
  const entry = failures.get(key);
  if (!entry || Date.now() - entry.first > WINDOW_MS) {
    failures.set(key, { count: 1, first: Date.now() });
    return;
  }
  entry.count += 1;
}

export function clearFailures(key: string): void {
  failures.delete(key);
}
