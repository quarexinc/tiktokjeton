import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { cookies, headers } from "next/headers";
import { getKey, readDB } from "./store";
import { codeField, sessionValid } from "./keys";
import type { MemberKey, Settings } from "./types";

export const COOKIE_NAME = "tjyb_admin";
export const MEMBER_COOKIE = "tjyb_member";
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 14; // admin: 14 gün

export function adminKeyConfigured(): boolean {
  return Boolean(process.env.ADMIN_KEY && process.env.ADMIN_KEY.length > 0);
}

function secret(): string {
  return process.env.SESSION_SECRET || process.env.ADMIN_KEY || "tjyb-dev-secret";
}

function hmac(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/* ------------------------------ Admin ------------------------------ */

export function checkKey(input: string): boolean {
  if (!adminKeyConfigured()) return false;
  const a = createHmac("sha256", "tjyb-key-cmp").update(process.env.ADMIN_KEY!).digest("hex");
  const b = createHmac("sha256", "tjyb-key-cmp").update(input).digest("hex");
  return safeEqual(a, b);
}

export function newSessionValue(): string {
  return createHmac("sha256", process.env.ADMIN_KEY ?? "").update("tjyb-admin-session-v1").digest("hex");
}

export async function isAdmin(): Promise<boolean> {
  if (!adminKeyConfigured()) return false;
  const v = (await cookies()).get(COOKIE_NAME)?.value;
  return Boolean(v && safeEqual(v, newSessionValue()));
}

/* ------------------------------ Üye ------------------------------ */

type MemberPayload = { c: string; v: number; iat: number };

export function memberCookieValue(k: MemberKey): string {
  const payload: MemberPayload = { c: codeField(k.code), v: k.sessionVersion, iat: Date.now() };
  const p = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${p}.${hmac(p)}`;
}

export function memberCookieMaxAge(k: MemberKey): number {
  if (!k.expiresAt) return 60 * 60 * 24 * 365;
  return Math.max(60, Math.floor((new Date(k.expiresAt).getTime() - Date.now()) / 1000));
}

export async function currentMember(): Promise<MemberKey | null> {
  const raw = (await cookies()).get(MEMBER_COOKIE)?.value;
  if (!raw) return null;
  const [p, sig] = raw.split(".");
  if (!p || !sig || !safeEqual(sig, hmac(p))) return null;
  let payload: MemberPayload;
  try {
    payload = JSON.parse(Buffer.from(p, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  const k = await getKey(payload.c).catch(() => null);
  if (!k || k.sessionVersion !== payload.v || !sessionValid(k, Date.now())) return null;
  return k;
}

/* ------------------------------ Erişim ------------------------------ */

export type Access = {
  admin: boolean;
  member: MemberKey | null;
  settings: Settings;
  /** Yayın listesini görebilir mi */
  allowed: boolean;
  /** Bakım modu yüzünden engellendi mi */
  blockedByMaintenance: boolean;
};

export async function getAccess(): Promise<Access> {
  const [admin, member, db] = await Promise.all([isAdmin(), currentMember(), readDB()]);
  const s = db.settings;
  const blockedByMaintenance = s.maintenance && !admin;
  const allowed = !blockedByMaintenance && (admin || !s.requireKey || member !== null);
  return { admin, member, settings: s, allowed, blockedByMaintenance };
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] || h.get("x-real-ip") || "local").trim();
}
