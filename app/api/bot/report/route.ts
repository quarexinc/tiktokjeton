import { randomUUID } from "crypto";
import { botRoute } from "@/lib/botApi";
import { cleanWatchlist } from "@/lib/bot";
import { addLog, mutateDB } from "@/lib/store";
import { endTime, formatCoins, liveUrl, statusOf } from "@/lib/status";
import { fail, json } from "@/lib/http";
import type { Stream } from "@/lib/types";

export const dynamic = "force-dynamic";

function toIso(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  // Unix saniye ya da milisaniye ya da ISO metin
  const d = Number.isFinite(n) ? new Date(n < 1e12 ? n * 1000 : n) : new Date(String(v));
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Bot, sandıklı bir yayın gördüğünde ya da sandık durumu değiştiğinde çağırır.
 * Gövde: { username, coins, chests, nextChestAt, title?, viewers?, url? }
 * Aynı kullanıcının açık bir yayını varsa güncellenir ve süresi uzatılır, yoksa yenisi eklenir.
 */
export const POST = botRoute(async (req, bot) => {
  const body = await req.json().catch(() => ({}));
  const [username] = cleanWatchlist([String(body.username ?? "")]);
  if (!username) return fail("Geçerli bir kullanıcı adı gönder.");

  const coins = Math.max(0, Math.round(Number(body.coins) || 0));
  const chests = Math.max(0, Math.round(Number(body.chests) || 0));
  const nextChestAt = toIso(body.nextChestAt);
  const viewers = Number.isFinite(Number(body.viewers)) ? Math.max(0, Math.round(Number(body.viewers))) : null;
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 120) : "";
  let url = typeof body.url === "string" && /^https?:\/\//.test(body.url) ? body.url.slice(0, 500) : "";
  if (!url) url = liveUrl(username);

  const now = Date.now();
  const iso = new Date(now).toISOString();
  let result = "skipped" as "created" | "updated" | "skipped";
  let reason = "";
  let created = null as Stream | null;

  await mutateDB((db) => {
    const open = db.streams
      .filter((s) => s.username.toLowerCase() === username && statusOf(s, now) !== "past")
      .sort((a, b) => +new Date(b.startsAt) - +new Date(a.startsAt))[0];

    if (open) {
      if (coins > 0) open.coins = coins;
      open.chests = chests;
      open.nextChestAt = nextChestAt;
      if (viewers !== null) open.viewers = viewers;
      open.botSeenAt = iso;
      if (open.source === "bot") open.title = title || (chests === 0 ? "Sandıklar açıldı, yayın sürüyor" : open.title);
      // Ana sayfada en az defaultDurationMin daha kalsın
      const wantEnd = now + bot.defaultDurationMin * 60_000;
      if (wantEnd > endTime(open) && statusOf(open, now) === "live") {
        const start = new Date(open.startsAt).getTime();
        open.durationMin = Math.ceil((wantEnd - start) / 60_000);
        open.endedAt = null;
      }
      result = "updated";
      return;
    }

    if (chests === 0 && coins === 0) {
      reason = "Sandık yok";
      return;
    }
    if (coins < bot.minCoins) {
      reason = `Minimum jeton (${bot.minCoins}) altında`;
      return;
    }

    created = {
      id: randomUUID(),
      username,
      title,
      url,
      coins: coins || null,
      note: "",
      startsAt: iso,
      durationMin: bot.defaultDurationMin,
      endedAt: null,
      featured: false,
      source: "bot",
      pending: !bot.autoPublish,
      chests,
      nextChestAt,
      viewers,
      botSeenAt: iso,
      createdAt: iso,
    };
    db.streams.push(created);
    result = "created";
  });

  if (result === "created" && created) {
    const c = created;
    await addLog(
      "bot",
      `Bot @${username} yayınını ${c.pending ? "onaya gönderdi" : "ekledi"}${coins ? ` (${formatCoins(coins)} jeton)` : ""}`
    );
  }
  return json({ ok: true, result, reason: reason || undefined, pending: result === "created" ? !bot.autoPublish : undefined });
});
