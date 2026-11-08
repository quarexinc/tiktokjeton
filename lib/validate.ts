import { liveUrl } from "./status";
import type { Settings, Stream } from "./types";

export type StreamInput = {
  username?: unknown;
  title?: unknown;
  url?: unknown;
  coins?: unknown;
  note?: unknown;
  startsAt?: unknown;
  durationMin?: unknown;
};

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export function cleanUsername(v: unknown): string {
  return str(v, 64).replace(/^@+/, "").replace(/\s+/g, "");
}

export function parseStreamInput(
  input: StreamInput,
  existing?: Stream
): Result<Omit<Stream, "id" | "createdAt" | "endedAt">> {
  const username = input.username !== undefined ? cleanUsername(input.username) : existing?.username ?? "";
  if (!/^[A-Za-z0-9._]{2,24}$/.test(username)) {
    return { ok: false, error: "Kullanıcı adı 2-24 karakter olmalı; harf, rakam, nokta ve alt çizgi kullanılabilir." };
  }

  const title = input.title !== undefined ? str(input.title, 120) : existing?.title ?? "";

  let url = input.url !== undefined ? str(input.url, 500) : existing?.url ?? "";
  if (!url) url = liveUrl(username);
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error();
  } catch {
    return { ok: false, error: "Yayın linki geçerli bir http(s) adresi olmalı." };
  }

  let coins: number | null = existing?.coins ?? null;
  if (input.coins !== undefined) {
    if (input.coins === null || input.coins === "") coins = null;
    else {
      const n = Number(input.coins);
      if (!Number.isFinite(n) || n < 0 || n > 100_000_000) {
        return { ok: false, error: "Jeton miktarı 0 ile 100.000.000 arasında bir sayı olmalı." };
      }
      coins = Math.round(n);
    }
  }

  const note = input.note !== undefined ? str(input.note, 240) : existing?.note ?? "";

  let startsAt = existing?.startsAt ?? new Date().toISOString();
  if (input.startsAt !== undefined && input.startsAt !== null && input.startsAt !== "") {
    const d = new Date(String(input.startsAt));
    if (isNaN(d.getTime())) return { ok: false, error: "Başlangıç tarihi okunamadı." };
    startsAt = d.toISOString();
  }

  let durationMin = existing?.durationMin ?? 60;
  if (input.durationMin !== undefined) {
    const n = Number(input.durationMin);
    if (!Number.isFinite(n) || n < 1 || n > 60 * 24 * 30) {
      return { ok: false, error: "Ana sayfada kalma süresi 1 dakika ile 30 gün arasında olmalı." };
    }
    durationMin = Math.round(n);
  }

  return { ok: true, value: { username, title, url, coins, note, startsAt, durationMin } };
}

export function parseSettings(input: Partial<Record<keyof Settings, unknown>>, current: Settings): Result<Settings> {
  const next = { ...current };
  if (input.announcement !== undefined) next.announcement = str(input.announcement, 200);
  if (input.showPast !== undefined) next.showPast = Boolean(input.showPast);
  if (input.pastLimit !== undefined) {
    const n = Number(input.pastLimit);
    if (!Number.isFinite(n) || n < 0 || n > 200) {
      return { ok: false, error: "Geçmiş yayın sayısı 0 ile 200 arasında olmalı." };
    }
    next.pastLimit = Math.round(n);
  }
  return { ok: true, value: next };
}
