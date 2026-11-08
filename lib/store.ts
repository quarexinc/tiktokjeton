import "server-only";
import { kv, storageKind, StorageMissingError } from "./kv";
import { DEFAULT_SETTINGS, type DB, type LogEntry, type MemberKey, type Overview, type Stream } from "./types";
import { codeField } from "./keys";

export { storageKind, StorageMissingError };

const K = {
  db: "tjyb:db",
  keys: "tjyb:keys",
  clicks: "tjyb:clicks",
  stats: "tjyb:stats",
  log: "tjyb:log",
};

/* ------------------------------ Yayınlar + ayarlar ------------------------------ */

function emptyDB(): DB {
  return { streams: [], settings: { ...DEFAULT_SETTINGS } };
}

function normalize(raw: unknown): DB {
  const db = emptyDB();
  if (!raw || typeof raw !== "object") return db;
  const r = raw as Partial<DB>;
  if (Array.isArray(r.streams)) db.streams = r.streams as Stream[];
  if (r.settings && typeof r.settings === "object") db.settings = { ...DEFAULT_SETTINGS, ...r.settings };
  return db;
}

export async function readDB(): Promise<DB> {
  const v = await kv().get(K.db);
  return v ? normalize(JSON.parse(v)) : emptyDB();
}

export async function mutateDB(fn: (db: DB) => void | DB): Promise<DB> {
  const db = await readDB();
  const next = fn(db) ?? db;
  await kv().set(K.db, JSON.stringify(next));
  return next;
}

/* ------------------------------ Üyelik anahtarları ------------------------------ */

export async function listKeys(): Promise<MemberKey[]> {
  const all = await kv().hgetall(K.keys);
  return Object.values(all)
    .map((v) => JSON.parse(v) as MemberKey)
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}

export async function getKey(code: string): Promise<MemberKey | null> {
  const v = await kv().hget(K.keys, codeField(code));
  return v ? (JSON.parse(v) as MemberKey) : null;
}

export async function saveKey(k: MemberKey): Promise<void> {
  await kv().hset(K.keys, codeField(k.code), JSON.stringify(k));
}

export async function deleteKey(code: string): Promise<void> {
  await kv().hdel(K.keys, codeField(code));
}

/* ------------------------------ Sayaçlar ------------------------------ */

export function dayKey(d = new Date()): string {
  // Türkiye saatine göre gün
  return new Date(d.getTime() + 3 * 3600_000).toISOString().slice(0, 10);
}

export async function addClick(streamId: string): Promise<void> {
  try {
    await Promise.all([
      kv().hincrby(K.clicks, streamId, 1),
      kv().hincrby(K.stats, `clicks:${dayKey()}`, 1),
    ]);
  } catch (e) {
    console.error("Tıklama sayılamadı", e);
  }
}

export async function addLoginStat(): Promise<void> {
  try {
    await kv().hincrby(K.stats, `logins:${dayKey()}`, 1);
  } catch {}
}

export async function rateLimit(bucket: string, id: string, max: number, windowSec: number): Promise<boolean> {
  try {
    const n = await kv().incrTTL(`tjyb:rl:${bucket}:${id}`, windowSec);
    return n <= max;
  } catch {
    return true;
  }
}

/* ------------------------------ Etkinlik kaydı ------------------------------ */

export async function addLog(type: LogEntry["type"], msg: string): Promise<void> {
  try {
    const e: LogEntry = { t: new Date().toISOString(), type, msg };
    await kv().lpushTrim(K.log, JSON.stringify(e), 300);
  } catch {}
}

export async function getOverview(): Promise<Overview> {
  const [clicksRaw, stats, logRaw] = await Promise.all([
    kv().hgetall(K.clicks),
    kv().hgetall(K.stats),
    kv().lrange(K.log, 80),
  ]);
  const clicks: Record<string, number> = {};
  for (const [k, v] of Object.entries(clicksRaw)) clicks[k] = Number(v) || 0;

  const days: string[] = [];
  for (let i = 13; i >= 0; i--) days.push(dayKey(new Date(Date.now() - i * 86400_000)));
  return {
    clicks,
    log: logRaw.map((x) => JSON.parse(x) as LogEntry),
    loginsByDay: days.map((day) => ({ day, count: Number(stats[`logins:${day}`] ?? 0) })),
    clicksByDay: days.map((day) => ({ day, count: Number(stats[`clicks:${day}`] ?? 0) })),
    storage: storageKind(),
  };
}

export async function getClicks(): Promise<Record<string, number>> {
  const raw = await kv().hgetall(K.clicks);
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) out[k] = Number(v) || 0;
  return out;
}

export async function removeClicks(streamId: string): Promise<void> {
  try {
    await kv().hdel(K.clicks, streamId);
  } catch {}
}
