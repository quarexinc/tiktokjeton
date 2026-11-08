import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export const COOKIE_NAME = "tjyb_admin";
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 14; // 14 gün

export function adminKeyConfigured(): boolean {
  return Boolean(process.env.ADMIN_KEY && process.env.ADMIN_KEY.length > 0);
}

function sessionToken(): string {
  const key = process.env.ADMIN_KEY ?? "";
  return createHmac("sha256", key).update("tjyb-admin-session-v1").digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function checkKey(input: string): boolean {
  if (!adminKeyConfigured()) return false;
  const expected = createHmac("sha256", "tjyb-key-cmp").update(process.env.ADMIN_KEY!).digest("hex");
  const given = createHmac("sha256", "tjyb-key-cmp").update(input).digest("hex");
  return safeEqual(expected, given);
}

export function newSessionValue(): string {
  return sessionToken();
}

export async function isAdmin(): Promise<boolean> {
  if (!adminKeyConfigured()) return false;
  const store = await cookies();
  const v = store.get(COOKIE_NAME)?.value;
  if (!v) return false;
  return safeEqual(v, sessionToken());
}
