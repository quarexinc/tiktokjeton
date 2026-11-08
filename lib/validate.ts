import { liveUrl } from "./status";
import type { MemberKey, Settings, Stream } from "./types";

export type StreamInput = {
  username?: unknown;
  title?: unknown;
  url?: unknown;
  coins?: unknown;
  note?: unknown;
  startsAt?: unknown;
  durationMin?: unknown;
  featured?: unknown;
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

  const featured = input.featured !== undefined ? Boolean(input.featured) : existing?.featured ?? false;

  return { ok: true, value: { username, title, url, coins, note, startsAt, durationMin, featured } };
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
  if (input.requireKey !== undefined) next.requireKey = Boolean(input.requireKey);
  if (input.maintenance !== undefined) next.maintenance = Boolean(input.maintenance);
  if (input.maintenanceText !== undefined) next.maintenanceText = str(input.maintenanceText, 200);
  if (input.contactLabel !== undefined) next.contactLabel = str(input.contactLabel, 40) || "Anahtar al";
  if (input.contactUrl !== undefined) {
    const u = str(input.contactUrl, 300);
    if (u) {
      try {
        const p = new URL(u);
        if (!["https:", "http:", "tg:", "mailto:", "tel:"].includes(p.protocol)) throw new Error();
      } catch {
        return { ok: false, error: "İletişim linki geçerli bir adres olmalı (https://...)." };
      }
    }
    next.contactUrl = u;
  }
  return { ok: true, value: next };
}

export type KeyInput = {
  count?: unknown;
  label?: unknown;
  maxUses?: unknown;
  durationDays?: unknown;
  startMode?: unknown;
};

export function parseKeyInput(
  input: KeyInput
): Result<{ count: number; label: string; maxUses: number | null; durationDays: number | null; startMode: MemberKey["startMode"] }> {
  const count = input.count === undefined ? 1 : Math.round(Number(input.count));
  if (!Number.isFinite(count) || count < 1 || count > 200) return { ok: false, error: "Tek seferde 1 ile 200 arası anahtar üretilebilir." };
  const label = str(input.label, 60);
  let maxUses: number | null = null;
  if (input.maxUses !== undefined && input.maxUses !== null && input.maxUses !== "") {
    const n = Math.round(Number(input.maxUses));
    if (!Number.isFinite(n) || n < 1 || n > 100000) return { ok: false, error: "Giriş hakkı 1 ile 100.000 arasında olmalı." };
    maxUses = n;
  }
  let durationDays: number | null = null;
  if (input.durationDays !== undefined && input.durationDays !== null && input.durationDays !== "") {
    const n = Number(input.durationDays);
    if (!Number.isFinite(n) || n <= 0 || n > 3650) return { ok: false, error: "Üyelik süresi 1 ile 3650 gün arasında olmalı." };
    durationDays = Math.round(n * 100) / 100;
  }
  const startMode = input.startMode === "created" ? "created" : "first-use";
  return { ok: true, value: { count, label, maxUses, durationDays, startMode } };
}
