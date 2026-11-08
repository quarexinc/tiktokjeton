import type { Metadata } from "next";
import { adminKeyConfigured, isAdmin } from "@/lib/auth";
import { getClicks, getOverview, listKeys, readDB, storageKind } from "@/lib/store";
import Login from "@/components/admin/Login";
import AdminApp, { type AdminState } from "@/components/admin/AdminApp";
import { DEFAULT_BOT, DEFAULT_SETTINGS } from "@/lib/types";
import { adminView, getBot } from "@/lib/bot";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Yönetim paneli | Tiktok Jetonlu Yayın Bulma",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  if (!(await isAdmin())) {
    return <Login configured={adminKeyConfigured()} />;
  }

  let storageError: string | null =
    storageKind() === "none"
      ? "Depolama bağlı değil: yayınlar ve anahtarlar kaydedilemez. Vercel'de tiktokjeton projesini aç, Storage sekmesinden Neon veritabanını (ücretsiz) bağla ve projeyi yeniden yayınla."
      : null;

  let state: AdminState;
  try {
    const [db, clicks, keys, overview, bot] = await Promise.all([readDB(), getClicks(), listKeys(), getOverview(), getBot()]);
    state = { db, clicks, keys, overview, bot: adminView(bot), now: Date.now() };
  } catch (e) {
    console.error(e);
    storageError = "Depolamaya ulaşılamadı. Vercel projesindeki Storage bağlantısını kontrol et.";
    state = {
      db: { streams: [], settings: { ...DEFAULT_SETTINGS } },
      clicks: {},
      keys: [],
      overview: { clicks: {}, log: [], loginsByDay: [], clicksByDay: [], storage: storageKind() },
      bot: adminView(DEFAULT_BOT),
      now: Date.now(),
    };
  }
  return <AdminApp initial={state} storageError={storageError} />;
}
