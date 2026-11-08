import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { kv } from "./kv";
import { DEFAULT_BOT, type BotConfig } from "./types";

const KEY = "tjyb:bot";

export async function getBot(): Promise<BotConfig> {
  const v = await kv().get(KEY);
  return v ? { ...DEFAULT_BOT, ...JSON.parse(v) } : { ...DEFAULT_BOT };
}

export async function saveBot(b: BotConfig): Promise<void> {
  await kv().set(KEY, JSON.stringify(b));
}

function sha(s: string) {
  return createHash("sha256").update(s).digest("hex");
}

/** Yeni API anahtarı üretir; düz hâli sadece bir kez döner */
export function newToken(): { token: string; hash: string; hint: string } {
  const token = `tjb_${randomBytes(24).toString("base64url")}`;
  return { token, hash: sha(token), hint: token.slice(-4) };
}

/** İstekteki Bearer anahtarını doğrular */
export async function verifyBotRequest(req: Request): Promise<BotConfig | null> {
  const h = req.headers.get("authorization") ?? "";
  const token = h.toLowerCase().startsWith("bearer ") ? h.slice(7).trim() : req.headers.get("x-api-key") ?? "";
  if (!token) return null;
  const bot = await getBot();
  if (!bot.tokenHash) return null;
  const a = Buffer.from(sha(token));
  const b = Buffer.from(bot.tokenHash);
  return a.length === b.length && timingSafeEqual(a, b) ? bot : null;
}

export function cleanWatchlist(input: unknown): string[] {
  const raw = Array.isArray(input) ? input.join("\n") : typeof input === "string" ? input : "";
  const out = new Set<string>();
  for (const part of raw.split(/[\s,;]+/)) {
    let u = part.trim();
    const m = u.match(/tiktok\.com\/@([A-Za-z0-9._]+)/);
    if (m) u = m[1];
    u = u.replace(/^@+/, "");
    if (/^[A-Za-z0-9._]{2,24}$/.test(u)) out.add(u.toLowerCase());
  }
  return [...out].slice(0, 1000);
}

/** Bot son 3 dakikada sinyal verdiyse çevrimiçi sayılır */
export function botOnline(b: BotConfig, now = Date.now()): boolean {
  return b.lastSeenAt !== null && now - new Date(b.lastSeenAt).getTime() < 3 * 60_000;
}

export type BotAdminView = Omit<BotConfig, "tokenHash"> & { hasToken: boolean };

export function adminView(b: BotConfig): BotAdminView {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { tokenHash, ...rest } = b;
  return { ...rest, hasToken: Boolean(tokenHash) };
}
