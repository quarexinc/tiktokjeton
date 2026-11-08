import "server-only";
import { readDB } from "./store";
import { splitStreams } from "./status";
import type { Stream } from "./types";

export type PublicPayload = {
  now: number;
  announcement: string;
  showPast: boolean;
  streams: Stream[];
};

/** Ana sayfaya gidecek veriyi hazırlar: geçmiş yayınlar ayara göre kırpılır. */
export async function getPublicPayload(): Promise<PublicPayload> {
  const db = await readDB();
  const now = Date.now();
  const { live, upcoming, past } = splitStreams(db.streams.filter((s) => !s.pending), now);
  const keptPast = db.settings.showPast ? past.slice(0, db.settings.pastLimit) : [];
  return {
    now,
    announcement: db.settings.announcement,
    showPast: db.settings.showPast,
    streams: [...live, ...upcoming, ...keptPast],
  };
}
