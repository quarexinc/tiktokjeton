import { botRoute } from "@/lib/botApi";
import { cleanWatchlist } from "@/lib/bot";
import { mutateDB } from "@/lib/store";
import { statusOf } from "@/lib/status";
import { fail, json } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Bot, takip ettiği yayın kapandığında çağırır. Sadece botun eklediği yayınlar bitirilir. */
export const POST = botRoute(async (req) => {
  const body = await req.json().catch(() => ({}));
  const [username] = cleanWatchlist([String(body.username ?? "")]);
  if (!username) return fail("Geçerli bir kullanıcı adı gönder.");
  const now = Date.now();
  let ended = 0;
  await mutateDB((db) => {
    for (const s of db.streams) {
      if (s.username.toLowerCase() !== username || statusOf(s, now) === "past") continue;
      s.chests = 0;
      s.nextChestAt = null;
      if (s.source === "bot") {
        s.endedAt = new Date(now).toISOString();
        ended++;
      }
    }
  });
  return json({ ok: true, ended });
});
