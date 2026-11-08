import "server-only";
import { get, put } from "@vercel/blob";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { DEFAULT_SETTINGS, type DB, type Stream } from "./types";

const BLOB_PATH = "tjyb/db.json";
const ACCESS: "public" | "private" =
  process.env.BLOB_ACCESS === "public" ? "public" : "private";
const LOCAL_FILE = path.join(
  process.env.VERCEL ? os.tmpdir() : path.join(process.cwd(), ".data"),
  "db.json"
);

function useBlob() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
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
  if (useBlob()) {
    const res = await get(BLOB_PATH, { access: ACCESS, useCache: false });
    if (!res || res.statusCode !== 200 || !res.stream) return emptyDB();
    const text = await new Response(res.stream).text();
    return normalize(JSON.parse(text));
  }
  try {
    const text = await fs.readFile(LOCAL_FILE, "utf8");
    return normalize(JSON.parse(text));
  } catch {
    return emptyDB();
  }
}

export async function writeDB(db: DB): Promise<void> {
  const body = JSON.stringify(db);
  if (useBlob()) {
    await put(BLOB_PATH, body, {
      access: ACCESS,
      allowOverwrite: true,
      addRandomSuffix: false,
      contentType: "application/json",
      cacheControlMaxAge: 60,
    });
    return;
  }
  await fs.mkdir(path.dirname(LOCAL_FILE), { recursive: true });
  await fs.writeFile(LOCAL_FILE, body, "utf8");
}

/** Oku, değiştir, yaz. Değiştirilmiş veritabanını döndürür. */
export async function mutateDB(fn: (db: DB) => void | DB): Promise<DB> {
  const db = await readDB();
  const next = fn(db) ?? db;
  await writeDB(next);
  return next;
}
