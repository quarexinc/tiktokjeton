import { adminView, getBot, newToken, saveBot } from "@/lib/bot";
import { addLog } from "@/lib/store";
import { adminRoute, json } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Yeni bot API anahtarı üretir. Eski anahtar hemen geçersiz olur. */
export const POST = adminRoute(async () => {
  const bot = await getBot();
  const t = newToken();
  bot.tokenHash = t.hash;
  bot.tokenHint = t.hint;
  bot.tokenCreatedAt = new Date().toISOString();
  await saveBot(bot);
  await addLog("bot", "Bot API anahtarı yenilendi");
  return json({ token: t.token, bot: adminView(bot) });
});
