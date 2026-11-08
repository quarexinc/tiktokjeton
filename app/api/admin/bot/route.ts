import { adminView, cleanWatchlist, getBot, saveBot } from "@/lib/bot";
import { addLog } from "@/lib/store";
import { adminRoute, fail, json } from "@/lib/http";

export const dynamic = "force-dynamic";

export const GET = adminRoute(async () => json({ bot: adminView(await getBot()) }));

export const PUT = adminRoute(async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  const bot = await getBot();
  if (body.autoPublish !== undefined) bot.autoPublish = Boolean(body.autoPublish);
  if (body.defaultDurationMin !== undefined) {
    const n = Math.round(Number(body.defaultDurationMin));
    if (!Number.isFinite(n) || n < 1 || n > 1440) return fail("Varsayılan süre 1 ile 1440 dakika arasında olmalı.");
    bot.defaultDurationMin = n;
  }
  if (body.minCoins !== undefined) {
    const n = Math.round(Number(body.minCoins));
    if (!Number.isFinite(n) || n < 0) return fail("Minimum jeton 0 ya da daha büyük olmalı.");
    bot.minCoins = n;
  }
  if (body.watchlist !== undefined) bot.watchlist = cleanWatchlist(body.watchlist);
  await saveBot(bot);
  await addLog("bot", "Otomasyon ayarları güncellendi");
  return json({ bot: adminView(bot) });
});
