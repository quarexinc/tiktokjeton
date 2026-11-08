import "server-only";
import { get, put } from "@vercel/blob";
import { promises as fs } from "fs";
import path from "path";
import { DEFAULT_SETTINGS, type DB, type Stream } from "./types";

/**
 * Depolama sırası:
 *  1. Upstash Redis (KV_REST_API_URL/KV_REST_API_TOKEN veya UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN)
 *  2. Vercel Blob (BLOB_READ_WRITE_TOKEN)
 *  3. Yerel dosya (sadece geliştirme ortamında)
 */

const KEY = "tjyb:db";
const BLOB_PATH = "tjyb/db.json";
const BLOB_ACCESS: "public" | "private" = process.env.BLOB_ACCESS === "public" ? "public" : "private";
const LOCAL_FILE = path.join(process.cwd(), ".data", "db.json");

export class StorageMissingError extends Error {
  constructor() {
    super("Depolama bağlı değil. Vercel projesine Upstash Redis (veya Blob) bağlayıp yeniden yayınla.");
  }
}

function redisConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

export function storageKind(): "redis" | "blob" | "local" | "none" {
  if (redisConfig()) return "redis";
  if (process.env.BLOB_READ_WRITE_TOKEN) return "blob";
  if (!process.env.VERCEL) return "local";
  return "none";
}

async function redis(command: (string | number)[]): Promise<unknown> {
  const cfg = redisConfig()!;
  const r = await fetch(cfg.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  const j = (await r.json().catch(() => ({}))) as { result?: unknown; error?: string };
  if (!r.ok || j.error) throw new Error(`Redis hatası: ${j.error ?? r.status}`);
  return j.result;
}

function emptyDB(): DB {
  return { streams: [], settings: { ...DEFAULT_SETTINGS } };
}

function normalize(raw: unknown): DB {
  const db = emptyDB();
  if (!raw || typeof raw !== "object") return db;
  const r = raw as Partial<DB>;
  if (Array.isArray(r.streams)) db.streams = r.streams as Stream[];
  if (r.settings && typeof r.settings === "object") {
    db.settings = { ...DEFAULT_SETTINGS, ...r.settings };
  }
  return db;
}

export async function readDB(): Promise<DB> {
  switch (storageKind()) {
    case "redis": {
      const v = await redis(["GET", KEY]);
      return typeof v === "string" ? normalize(JSON.parse(v)) : emptyDB();
    }
    case "blob": {
      const res = await get(BLOB_PATH, { access: BLOB_ACCESS, useCache: false });
      if (!res || res.statusCode !== 200 || !res.stream) return emptyDB();
      return normalize(JSON.parse(await new Response(res.stream).text()));
    }
    case "local":
      try {
        return normalize(JSON.parse(await fs.readFile(LOCAL_FILE, "utf8")));
      } catch {
        return emptyDB();
      }
    default:
      return emptyDB();
  }
}

export async function writeDB(db: DB): Promise<void> {
  const body = JSON.stringify(db);
  switch (storageKind()) {
    case "redis":
      await redis(["SET", KEY, body]);
      return;
    case "blob":
      await put(BLOB_PATH, body, {
        access: BLOB_ACCESS,
        allowOverwrite: true,
        addRandomSuffix: false,
        contentType: "application/json",
        cacheControlMaxAge: 60,
      });
      return;
    case "local":
      await fs.mkdir(path.dirname(LOCAL_FILE), { recursive: true });
      await fs.writeFile(LOCAL_FILE, body, "utf8");
      return;
    default:
      throw new StorageMissingError();
  }
}

/** Oku, değiştir, yaz. Değiştirilmiş veritabanını döndürür. */
export async function mutateDB(fn: (db: DB) => void | DB): Promise<DB> {
  const db = await readDB();
  const next = fn(db) ?? db;
  await writeDB(next);
  return next;
}
