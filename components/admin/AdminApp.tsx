"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { Bot, ExternalLink, Gauge, KeyRound, LogOut, Radio, Settings2, TriangleAlert, type LucideIcon } from "lucide-react";
import { CoinMark } from "../Coin";
import OverviewTab from "./OverviewTab";
import StreamsTab from "./StreamsTab";
import KeysTab from "./KeysTab";
import SettingsTab from "./SettingsTab";
import BotTab from "./BotTab";
import type { DB, MemberKey, Overview } from "@/lib/types";
import type { BotAdminView } from "@/lib/bot";

export type AdminState = {
  db: DB;
  clicks: Record<string, number>;
  keys: MemberKey[];
  overview: Overview;
  bot: BotAdminView;
  now: number;
};

type Toast = { id: number; text: string; tone: "ok" | "err" };
type TabId = "overview" | "streams" | "keys" | "bot" | "settings";

type Ctx = {
  state: AdminState;
  now: number;
  setState: React.Dispatch<React.SetStateAction<AdminState>>;
  toast: (text: string, tone?: Toast["tone"]) => void;
  /** JSON isteği atar; hata olursa bildirim gösterip null döner */
  api: <T = Record<string, unknown>>(url: string, init?: RequestInit, okText?: string) => Promise<T | null>;
  go: (tab: TabId) => void;
  refreshOverview: () => Promise<void>;
};

const AdminCtx = createContext<Ctx | null>(null);
export const useAdmin = () => useContext(AdminCtx)!;

const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: "overview", label: "Genel bakış", icon: Gauge },
  { id: "streams", label: "Yayınlar", icon: Radio },
  { id: "keys", label: "Anahtarlar", icon: KeyRound },
  { id: "bot", label: "Otomasyon", icon: Bot },
  { id: "settings", label: "Ayarlar", icon: Settings2 },
];

export default function AdminApp({ initial, storageError }: { initial: AdminState; storageError: string | null }) {
  const [state, setState] = useState(initial);
  const [now, setNow] = useState(initial.now);
  const [tab, setTab] = useState<TabId>("overview");
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    try {
      const saved = sessionStorage.getItem("tjyb_admin_tab") as TabId | null;
      if (saved && TABS.some((t) => t.id === saved)) setTab(saved);
    } catch {}
    return () => clearInterval(t);
  }, []);

  const go = useCallback((t: TabId) => {
    setTab(t);
    try {
      sessionStorage.setItem("tjyb_admin_tab", t);
    } catch {}
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const toast = useCallback((text: string, tone: Toast["tone"] = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const api = useCallback(
    async <T,>(url: string, init: RequestInit = {}, okText?: string): Promise<T | null> => {
      try {
        const r = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init.headers ?? {}) } });
        const j = await r.json().catch(() => ({}));
        if (r.status === 401) {
          toast("Oturum süresi doldu. Tekrar giriş yap.", "err");
          setTimeout(() => window.location.reload(), 1200);
          return null;
        }
        if (!r.ok) {
          toast(j.error ?? `İşlem tamamlanamadı (sunucu yanıtı ${r.status}).`, "err");
          return null;
        }
        if (okText) toast(okText);
        return j as T;
      } catch {
        toast("Sunucuya ulaşılamadı.", "err");
        return null;
      }
    },
    [toast]
  );

  const refreshOverview = useCallback(async () => {
    const o = await api<Overview>("/api/admin/overview");
    if (o) setState((s) => ({ ...s, overview: o }));
  }, [api]);

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    window.location.reload();
  }

  return (
    <AdminCtx.Provider value={{ state, now, setState, toast, api, go, refreshOverview }}>
      <MotionConfig reducedMotion="user">
        <div className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8">
          <aside className="lg:sticky lg:top-0 lg:h-dvh lg:py-6">
            <div className="flex items-center justify-between gap-3 py-5 lg:py-0">
              <div className="flex items-center gap-2.5">
                <CoinMark size={32} />
                <div>
                  <div className="font-display text-[16px] leading-tight font-bold">Yönetim</div>
                  <div className="text-[12px] text-muted">Tiktok Jetonlu Yayın Bulma</div>
                </div>
              </div>
              <div className="flex gap-1 lg:hidden">
                <a href="/" target="_blank" className="grid size-10 place-items-center rounded-xl border border-line text-muted hover:text-text" aria-label="Siteyi aç">
                  <ExternalLink className="size-4" />
                </a>
                <button onClick={logout} className="grid size-10 place-items-center rounded-xl border border-line text-muted hover:text-live" aria-label="Çıkış">
                  <LogOut className="size-4" />
                </button>
              </div>
            </div>

            <nav className="sticky top-0 z-20 -mx-4 mb-5 flex gap-1 overflow-x-auto border-b border-line bg-ink/90 px-4 py-2 backdrop-blur lg:static lg:mx-0 lg:mt-8 lg:flex-col lg:border-0 lg:bg-transparent lg:p-0">
              {TABS.map((t) => {
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => go(t.id)}
                    className={`relative flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-[15px] font-semibold whitespace-nowrap transition-colors ${
                      active ? "text-ink" : "text-muted hover:text-text"
                    }`}
                  >
                    {active && (
                      <motion.span layoutId="admin-tab" className="absolute inset-0 rounded-xl bg-gold" transition={{ type: "spring", stiffness: 380, damping: 32 }} />
                    )}
                    <t.icon className="relative size-4" aria-hidden="true" />
                    <span className="relative">{t.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="hidden space-y-1 lg:absolute lg:bottom-6 lg:block lg:w-[220px]">
              <a href="/" target="_blank" className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-[14px] font-semibold text-muted hover:text-text">
                <ExternalLink className="size-4" aria-hidden="true" />
                Siteyi aç
              </a>
              <button onClick={logout} className="flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-[14px] font-semibold text-muted hover:text-live">
                <LogOut className="size-4" aria-hidden="true" />
                Çıkış yap
              </button>
            </div>
          </aside>

          <main className="min-w-0 lg:py-6">
            {storageError && (
              <div className="mb-6 flex gap-3 rounded-2xl border border-live/40 bg-live/10 p-4 text-[14px] leading-relaxed">
                <TriangleAlert className="mt-0.5 size-5 shrink-0 text-live" aria-hidden="true" />
                <p>{storageError}</p>
              </div>
            )}
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
              >
                {tab === "overview" && <OverviewTab />}
                {tab === "streams" && <StreamsTab />}
                {tab === "keys" && <KeysTab />}
                {tab === "bot" && <BotTab />}
                {tab === "settings" && <SettingsTab />}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>

        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4" aria-live="polite">
          <AnimatePresence>
            {toasts.map((t) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8 }}
                className={`rounded-xl px-4 py-3 text-[14px] font-semibold shadow-lg ${t.tone === "ok" ? "bg-gold text-ink" : "bg-live text-white"}`}
              >
                {t.text}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </MotionConfig>
    </AdminCtx.Provider>
  );
}

export function PageHead({ title, desc, action }: { title: string; desc?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">{title}</h1>
        {desc && <p className="mt-1 max-w-xl text-[15px] text-muted">{desc}</p>}
      </div>
      {action}
    </div>
  );
}
