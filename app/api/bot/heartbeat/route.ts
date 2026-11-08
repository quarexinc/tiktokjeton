import { saveBot } from "@/lib/bot";
import { botRoute, publicBotConfig } from "@/lib/botApi";
import { readDB } from "@/lib/store";
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
    discovery: body.discovery === undefined ? undefined : Boolean(body.discovery),
    pool: body.pool === undefined ? undefined : n(body.pool),
    probing: body.probing === undefined ? undefined : n(body.probing),
    holding: body.holding === undefined ? undefined : n(body.holding),
    chestAccounts: body.chestAccounts === undefined ? undefined : n(body.chestAccounts),
    discoveredToday: body.discoveredToday === undefined ? undefined : n(body.discoveredToday),
  };
  await saveBot(bot);
  // Sitede daha önce görünen yayıncılar botun keşfe başlaması için tohum olur
  const db = await readDB();
  const knownUsernames = [...new Set(db.streams.map((s) => s.username.toLowerCase()))].slice(-300);
  return json({ ok: true, config: { ...publicBotConfig(bot), knownUsernames } });
});

export const GET = botRoute(async (_req, bot) => json({ ok: true, config: publicBotConfig(bot) }));
