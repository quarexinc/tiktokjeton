import "server-only";
import { verifyBotRequest } from "./bot";
import { fail, safe } from "./http";
import type { BotConfig } from "./types";

/** Sadece geçerli bot API anahtarıyla çalışan route sarmalayıcı */
export function botRoute(fn: (req: Request, bot: BotConfig) => Promise<Response>) {
  return (req: Request) =>
    safe(async () => {
      const bot = await verifyBotRequest(req);
      if (!bot) return fail("API anahtarı geçersiz. Admin panelinde Otomasyon sekmesinden yeni anahtar oluştur.", 401);
      return fn(req, bot);
    });
}

export function publicBotConfig(b: BotConfig) {
  return {
    watchlist: b.watchlist,
    minCoins: b.minCoins,
    defaultDurationMin: b.defaultDurationMin,
    autoPublish: b.autoPublish,
    serverTime: new Date().toISOString(),
  };
}
