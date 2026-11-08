import { saveBot } from "@/lib/bot";
import { botRoute, publicBotConfig } from "@/lib/botApi";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Bot dakikada bir çağırır: durumunu bildirir, güncel izleme listesini alır */
export const POST = botRoute(async (req, bot) => {
  const body = await req.json().catch(() => ({}));
  const n = (v: unknown) => (Number.isFinite(Number(v)) ? Math.max(0, Math.round(Number(v))) : 0);
  bot.lastSeenAt = new Date().toISOString();
  bot.lastStatus = {
    watching: n(body.watching),
    live: n(body.live),
    connected: n(body.connected),
    version: typeof body.version === "string" ? body.version.slice(0, 20) : "",
    host: typeof body.host === "string" ? body.host.slice(0, 60) : "",
  };
  await saveBot(bot);
  return json({ ok: true, config: publicBotConfig(bot) });
});

export const GET = botRoute(async (_req, bot) => json({ ok: true, config: publicBotConfig(bot) }));
