import "server-only";
import { get, put } from "@vercel/blob";
import { neon } from "@neondatabase/serverless";
import { promises as fs } from "fs";
import path from "path";

/**
 * Küçük bir anahtar-değer katmanı.
 *  0. Neon Postgres (DATABASE_URL / POSTGRES_URL) — önerilen
 *  1. Upstash Redis REST (KV_REST_API_URL/KV_REST_API_TOKEN veya UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN)
 *  2. Vercel Blob (BLOB_READ_WRITE_TOKEN) — tüm veri tek JSON belgesinde
 *  3. Yerel dosya (sadece geliştirme)
 */

export type StorageKind = "neon" | "redis" | "blob" | "local" | "none";

export class StorageMissingError extends Error {
  constructor() {
    super("Depolama bağlı değil. Vercel projesine Neon veritabanı bağlayıp yeniden yayınla.");
    this.name = "StorageMissingError";
  }
}

export interface KV {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  hget(key: string, field: string): Promise<string | null>;
  hset(key: string, field: string, value: string): Promise<void>;
  hdel(key: string, field: string): Promise<void>;
  hgetall(key: string): Promise<Record<string, string>>;
  hincrby(key: string, field: string, by: number): Promise<number>;
  lpushTrim(key: string, value: string, max: number): Promise<void>;
  lrange(key: string, count: number): Promise<string[]>;
  /** Sayaç artırır; ilk artışta süre (sn) koyar. Hız sınırı için. */
  incrTTL(key: string, ttlSec: number): Promise<number>;
}

function redisConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

export function neonUrl(): string | null {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL || null;
}

export function storageKind(): StorageKind {
  if (neonUrl()) return "neon";
  if (redisConfig()) return "redis";
  if (process.env.BLOB_READ_WRITE_TOKEN) return "blob";
  if (!process.env.VERCEL) return "local";
  return "none";
}

/* ------------------------------ Neon Postgres ------------------------------ */

export type QueryFn = (text: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS tj_kv (k TEXT PRIMARY KEY, v TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS tj_hash (k TEXT NOT NULL, f TEXT NOT NULL, v TEXT NOT NULL, PRIMARY KEY (k, f))`,
  `CREATE TABLE IF NOT EXISTS tj_list (id BIGSERIAL PRIMARY KEY, k TEXT NOT NULL, v TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS tj_list_k_id ON tj_list (k, id DESC)`,
  `CREATE TABLE IF NOT EXISTS tj_counter (k TEXT PRIMARY KEY, n BIGINT NOT NULL, exp TIMESTAMPTZ NOT NULL)`,
];

export class PostgresKV implements KV {
  private ready: Promise<void> | null = null;
  constructor(private q: QueryFn) {}

  private init(): Promise<void> {
    if (!this.ready) {
      this.ready = (async () => {
        for (const stmt of SCHEMA) await this.q(stmt);
      })().catch((e) => {
        this.ready = null;
        throw e;
      });
    }
    return this.ready;
  }

  private async rows(text: string, params: unknown[] = []) {
    await this.init();
    return this.q(text, params);
  }

  async get(key: string) {
    const r = await this.rows(`SELECT v FROM tj_kv WHERE k = $1`, [key]);
    return r.length ? String(r[0].v) : null;
  }
  async set(key: string, value: string) {
    await this.rows(`INSERT INTO tj_kv (k, v) VALUES ($1, $2) ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v`, [key, value]);
  }
  async hget(key: string, field: string) {
    const r = await this.rows(`SELECT v FROM tj_hash WHERE k = $1 AND f = $2`, [key, field]);
    return r.length ? String(r[0].v) : null;
  }
  async hset(key: string, field: string, value: string) {
    await this.rows(
      `INSERT INTO tj_hash (k, f, v) VALUES ($1, $2, $3) ON CONFLICT (k, f) DO UPDATE SET v = EXCLUDED.v`,
      [key, field, value]
    );
  }
  async hdel(key: string, field: string) {
    await this.rows(`DELETE FROM tj_hash WHERE k = $1 AND f = $2`, [key, field]);
  }
  async hgetall(key: string) {
    const r = await this.rows(`SELECT f, v FROM tj_hash WHERE k = $1`, [key]);
    const out: Record<string, string> = {};
    for (const row of r) out[String(row.f)] = String(row.v);
    return out;
  }
  async hincrby(key: string, field: string, by: number) {
    const r = await this.rows(
      `INSERT INTO tj_hash (k, f, v) VALUES ($1, $2, ($3::bigint)::text)
       ON CONFLICT (k, f) DO UPDATE SET v = (tj_hash.v::bigint + $3::bigint)::text
       RETURNING v`,
      [key, field, by]
    );
    return Number(r[0]?.v ?? 0);
  }
  async lpushTrim(key: string, value: string, max: number) {
    await this.rows(`INSERT INTO tj_list (k, v) VALUES ($1, $2)`, [key, value]);
    // Her seferinde değil, ara ara kırp
    if (Math.random() < 0.1) {
      await this.rows(
        `DELETE FROM tj_list WHERE k = $1 AND id < (
           SELECT COALESCE(MIN(id), 0) FROM (SELECT id FROM tj_list WHERE k = $1 ORDER BY id DESC LIMIT $2) t)`,
        [key, max]
      );
    }
  }
  async lrange(key: string, count: number) {
    const r = await this.rows(`SELECT v FROM tj_list WHERE k = $1 ORDER BY id DESC LIMIT $2`, [key, count]);
    return r.map((row) => String(row.v));
  }
  async incrTTL(key: string, ttlSec: number) {
    const r = await this.rows(
      `INSERT INTO tj_counter (k, n, exp) VALUES ($1, 1, now() + make_interval(secs => $2))
       ON CONFLICT (k) DO UPDATE SET
         n = CASE WHEN tj_counter.exp < now() THEN 1 ELSE tj_counter.n + 1 END,
         exp = CASE WHEN tj_counter.exp < now() THEN EXCLUDED.exp ELSE tj_counter.exp END
       RETURNING n`,
      [key, ttlSec]
    );
    if (Math.random() < 0.02) await this.rows(`DELETE FROM tj_counter WHERE exp < now()`);
    return Number(r[0]?.n ?? 0);
  }
}

function neonKV(url: string): KV {
  // Bağlantı havuzu gerektirmeyen HTTP sürücüsü: sunucusuz ortam için uygun
  const sql = neon(url);
  return new PostgresKV(async (text, params = []) => (await sql.query(text, params)) as Record<string, unknown>[]);
}

/* ------------------------------ Redis ------------------------------ */

class RedisKV implements KV {
  constructor(private url: string, private token: string) {}

  private async call<T = unknown>(cmd: (string | number)[]): Promise<T> {
    const r = await fetch(this.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(cmd),
      cache: "no-store",
    });
    const j = (await r.json().catch(() => ({}))) as { result?: T; error?: string };
    if (!r.ok || j.error) throw new Error(`Redis hatası: ${j.error ?? r.status}`);
    return j.result as T;
  }

  private async pipeline(cmds: (string | number)[][]): Promise<unknown[]> {
    const r = await fetch(`${this.url}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(cmds),
      cache: "no-store",
    });
    const j = (await r.json().catch(() => [])) as { result?: unknown; error?: string }[];
    if (!r.ok || !Array.isArray(j)) throw new Error(`Redis hatası: ${r.status}`);
    const err = j.find((x) => x.error);
    if (err) throw new Error(`Redis hatası: ${err.error}`);
    return j.map((x) => x.result);
  }

  get(key: string) {
    return this.call<string | null>(["GET", key]);
  }
  async set(key: string, value: string) {
    await this.call(["SET", key, value]);
  }
  hget(key: string, field: string) {
    return this.call<string | null>(["HGET", key, field]);
  }
  async hset(key: string, field: string, value: string) {
    await this.call(["HSET", key, field, value]);
  }
  async hdel(key: string, field: string) {
    await this.call(["HDEL", key, field]);
  }
  async hgetall(key: string) {
    const flat = (await this.call<string[] | null>(["HGETALL", key])) ?? [];
    const out: Record<string, string> = {};
    for (let i = 0; i < flat.length; i += 2) out[flat[i]] = flat[i + 1];
    return out;
  }
  async hincrby(key: string, field: string, by: number) {
    return Number(await this.call(["HINCRBY", key, field, by]));
  }
  async lpushTrim(key: string, value: string, max: number) {
    await this.pipeline([
      ["LPUSH", key, value],
      ["LTRIM", key, 0, max - 1],
    ]);
  }
  async lrange(key: string, count: number) {
    return (await this.call<string[] | null>(["LRANGE", key, 0, count - 1])) ?? [];
  }
  async incrTTL(key: string, ttlSec: number) {
    const [, n] = await this.pipeline([
      ["SET", key, "0", "EX", ttlSec, "NX"],
      ["INCR", key],
    ]);
    return Number(n);
  }
}

/* ------------------- Tek belgeli (yerel dosya / Blob) ------------------- */

type Doc = {
  s: Record<string, string>;
  h: Record<string, Record<string, string>>;
  l: Record<string, string[]>;
  ttl: Record<string, { n: number; exp: number }>;
};

const emptyDoc = (): Doc => ({ s: {}, h: {}, l: {}, ttl: {} });

class DocKV implements KV {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private load: () => Promise<Doc>, private save: (d: Doc) => Promise<void>) {}

  private read() {
    return this.load();
  }
  /** Aynı süreçteki yazmaları sıraya koyar */
  private write<T>(fn: (d: Doc) => T): Promise<T> {
    const run = this.queue.then(async () => {
      const d = await this.load();
      const out = fn(d);
      await this.save(d);
      return out;
    });
    this.queue = run.catch(() => {});
    return run;
  }

  async get(key: string) {
    return (await this.read()).s[key] ?? null;
  }
  set(key: string, value: string) {
    return this.write((d) => void (d.s[key] = value));
  }
  async hget(key: string, field: string) {
    return (await this.read()).h[key]?.[field] ?? null;
  }
  hset(key: string, field: string, value: string) {
    return this.write((d) => void ((d.h[key] ??= {})[field] = value));
  }
  hdel(key: string, field: string) {
    return this.write((d) => void delete d.h[key]?.[field]);
  }
  async hgetall(key: string) {
    return { ...((await this.read()).h[key] ?? {}) };
  }
  hincrby(key: string, field: string, by: number) {
    return this.write((d) => {
      const h = (d.h[key] ??= {});
      const n = Number(h[field] ?? 0) + by;
      h[field] = String(n);
      return n;
    });
  }
  lpushTrim(key: string, value: string, max: number) {
    return this.write((d) => {
      d.l[key] = [value, ...(d.l[key] ?? [])].slice(0, max);
    });
  }
  async lrange(key: string, count: number) {
    return ((await this.read()).l[key] ?? []).slice(0, count);
  }
  incrTTL(key: string, ttlSec: number) {
    return this.write((d) => {
      const now = Date.now();
      const cur = d.ttl[key];
      if (!cur || cur.exp < now) d.ttl[key] = { n: 1, exp: now + ttlSec * 1000 };
      else cur.n++;
      for (const k of Object.keys(d.ttl)) if (d.ttl[k].exp < now) delete d.ttl[k];
      return d.ttl[key].n;
    });
  }
}

const LOCAL_FILE = path.join(process.cwd(), ".data", "kv.json");
const BLOB_PATH = "tjyb/kv.json";
const BLOB_ACCESS: "public" | "private" = process.env.BLOB_ACCESS === "public" ? "public" : "private";

function localKV() {
  return new DocKV(
    async () => {
      try {
        return { ...emptyDoc(), ...JSON.parse(await fs.readFile(LOCAL_FILE, "utf8")) };
      } catch {
        return emptyDoc();
      }
    },
    async (d) => {
      await fs.mkdir(path.dirname(LOCAL_FILE), { recursive: true });
      await fs.writeFile(LOCAL_FILE, JSON.stringify(d), "utf8");
    }
  );
}

function blobKV() {
  return new DocKV(
    async () => {
      const res = await get(BLOB_PATH, { access: BLOB_ACCESS, useCache: false });
      if (!res || res.statusCode !== 200 || !res.stream) return emptyDoc();
      return { ...emptyDoc(), ...JSON.parse(await new Response(res.stream).text()) };
    },
    async (d) => {
      await put(BLOB_PATH, JSON.stringify(d), {
        access: BLOB_ACCESS,
        allowOverwrite: true,
        addRandomSuffix: false,
        contentType: "application/json",
        cacheControlMaxAge: 60,
      });
    }
  );
}

class NoneKV implements KV {
  private fail(): never {
    throw new StorageMissingError();
  }
  async get() {
    return null;
  }
  async set() {
    this.fail();
  }
  async hget() {
    return null;
  }
  async hset() {
    this.fail();
  }
  async hdel() {
    this.fail();
  }
  async hgetall() {
    return {};
  }
  async hincrby() {
    return 0;
  }
  async lpushTrim() {}
  async lrange() {
    return [];
  }
  async incrTTL() {
    return 0;
  }
}

let instance: KV | null = null;

export function kv(): KV {
  if (instance) return instance;
  const kind = storageKind();
  if (kind === "neon") instance = neonKV(neonUrl()!);
  else if (kind === "redis") {
    const c = redisConfig()!;
    instance = new RedisKV(c.url, c.token);
  } else if (kind === "blob") instance = blobKV();
  else if (kind === "local") instance = localKV();
  else instance = new NoneKV();
  return instance;
}
