import type { Stream, StreamStatus } from "./types";

export function endTime(s: Stream): number {
  const planned = new Date(s.startsAt).getTime() + s.durationMin * 60_000;
  if (s.endedAt) return Math.min(planned, new Date(s.endedAt).getTime());
  return planned;
}

export function statusOf(s: Stream, now: number): StreamStatus {
  const start = new Date(s.startsAt).getTime();
  if (now < start) return "upcoming";
  if (now < endTime(s)) return "live";
  return "past";
}

export function splitStreams(streams: Stream[], now: number) {
  const live: Stream[] = [];
  const upcoming: Stream[] = [];
  const past: Stream[] = [];
  for (const s of streams) {
    const st = statusOf(s, now);
    if (st === "live") live.push(s);
    else if (st === "upcoming") upcoming.push(s);
    else past.push(s);
  }
  // Aktif: bitişi en yakın olan önce değil, en yeni başlayan önce
  live.sort((a, b) => +new Date(b.startsAt) - +new Date(a.startsAt));
  upcoming.sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
  past.sort((a, b) => endTime(b) - endTime(a));
  return { live, upcoming, past };
}

export function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (d > 0) return `${d} gün ${h} sa`;
  if (h > 0) return `${h} sa ${m} dk`;
  if (m > 0) return `${m} dk ${s.toString().padStart(2, "0")} sn`;
  return `${s} sn`;
}

export function formatAgo(ms: number): string {
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "az önce";
  if (min < 60) return `${min} dk önce`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} saat önce`;
  const d = Math.floor(h / 24);
  return `${d} gün önce`;
}

export function formatCoins(n: number): string {
  return n.toLocaleString("tr-TR");
}

export function profileUrl(username: string): string {
  return `https://www.tiktok.com/@${username}`;
}

export function liveUrl(username: string): string {
  return `https://www.tiktok.com/@${username}/live`;
}
