import { addLog, getClicks, mutateDB, readDB, removeClicks } from "@/lib/store";
import { parseStreamInput } from "@/lib/validate";
import { endTime } from "@/lib/status";
import { adminRoute, fail, json } from "@/lib/http";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Gövde:
 *  - { action: "end" }             yayını hemen geçmişe taşır
 *  - { action: "extend", minutes } süreyi uzatır (bitmişse şimdiden itibaren)
 *  - { action: "feature", value }  öne çıkarır / kaldırır
 *  - diğer alanlar                  düzenleme
 */
export const PATCH = adminRoute(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const current = await readDB();
  const stream = current.streams.find((s) => s.id === id);
  if (!stream) return fail("Yayın bulunamadı.", 404);

  const now = Date.now();
  let error: string | null = null;
  let logMsg = `@${stream.username} yayını düzenlendi`;

  const db = await mutateDB((db) => {
    const s = db.streams.find((x) => x.id === id);
    if (!s) return;

    if (body.action === "end") {
      s.endedAt = new Date(now).toISOString();
      logMsg = `@${s.username} yayını bitirildi`;
      return;
    }
    if (body.action === "feature") {
      s.featured = Boolean(body.value);
      logMsg = `@${s.username} ${s.featured ? "öne çıkarıldı" : "öne çıkanlardan kaldırıldı"}`;
      return;
    }
    if (body.action === "extend") {
      const minutes = Math.round(Number(body.minutes));
      if (!Number.isFinite(minutes) || minutes < 1 || minutes > 60 * 24 * 7) {
        error = "Uzatma süresi 1 dakika ile 7 gün arasında olmalı.";
        return;
      }
      const start = new Date(s.startsAt).getTime();
      const base = Math.max(endTime(s), now);
      s.endedAt = null;
      s.durationMin = Math.ceil((base + minutes * 60_000 - start) / 60_000);
      logMsg = `@${s.username} yayını ${minutes} dk uzatıldı`;
      return;
    }

    const parsed = parseStreamInput(body, s);
    if (!parsed.ok) {
      error = parsed.error;
      return;
    }
    Object.assign(s, parsed.value);
  });

  if (error) return fail(error);
  await addLog("stream_updated", logMsg);
  return json({ ...db, clicks: await getClicks(), now: Date.now() });
});

export const DELETE = adminRoute(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  let name = "";
  const db = await mutateDB((db) => {
    name = db.streams.find((s) => s.id === id)?.username ?? "";
    db.streams = db.streams.filter((s) => s.id !== id);
  });
  await removeClicks(id);
  await addLog("stream_deleted", `@${name} yayını silindi`);
  return json({ ...db, clicks: await getClicks(), now: Date.now() });
});
