export type Stream = {
  id: string;
  username: string;
  title: string;
  url: string;
  coins: number | null;
  note: string;
  /** ISO tarih: yayının ana sayfada görünmeye başlayacağı an */
  startsAt: string;
  /** Ana sayfada "aktif" olarak kalma süresi (dakika) */
  durationMin: number;
  /** Admin elle bitirdiyse ISO tarih */
  endedAt: string | null;
  createdAt: string;
};

export type Settings = {
  announcement: string;
  showPast: boolean;
  pastLimit: number;
};

export type DB = {
  streams: Stream[];
  settings: Settings;
};

export type StreamStatus = "live" | "upcoming" | "past";

export const DEFAULT_SETTINGS: Settings = {
  announcement: "",
  showPast: true,
  pastLimit: 24,
};
