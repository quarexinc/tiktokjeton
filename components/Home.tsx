"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { CalendarClock, History, Megaphone, Radio, RefreshCw } from "lucide-react";
import { CoinMark, SpinningCoin } from "./Coin";
import { EmptyState, LiveCard, PastRow, UpcomingCard } from "./StreamItems";
import { splitStreams } from "@/lib/status";
import type { PublicPayload } from "@/lib/public";

type Tab = "live" | "upcoming" | "past";
const POLL_MS = 30_000;

export default function Home({ initial }: { initial: PublicPayload }) {
  const [data, setData] = useState(initial);
  const [now, setNow] = useState(initial.now);
  const [refreshing, setRefreshing] = useState(false);

  // Saniyelik saat: geri sayımlar ve aktif → geçmiş geçişi
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  async function refresh() {
    setRefreshing(true);
    try {
      const r = await fetch("/api/streams", { cache: "no-store" });
      if (r.ok) setData(await r.json());
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    const t = setInterval(refresh, POLL_MS);
    const onVis = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const { live, upcoming, past } = useMemo(() => splitStreams(data.streams, now), [data.streams, now]);
  const [tab, setTab] = useState<Tab>(() => {
    const s = splitStreams(initial.streams, initial.now);
    return s.live.length ? "live" : s.upcoming.length ? "upcoming" : "live";
  });

  const tabs: { id: Tab; label: string; count: number; icon: typeof Radio }[] = [
    { id: "live", label: "Aktif", count: live.length, icon: Radio },
    { id: "upcoming", label: "Yaklaşan", count: upcoming.length, icon: CalendarClock },
    ...(data.showPast ? [{ id: "past" as Tab, label: "Geçmiş", count: past.length, icon: History }] : []),
  ];

  return (
    <MotionConfig reducedMotion="user">
      <div className="grain pointer-events-none fixed inset-0 z-0" aria-hidden="true" />
      <div className="relative z-10 mx-auto flex min-h-dvh max-w-4xl flex-col px-4 sm:px-6">
        <header className="flex items-center justify-between py-5">
          <Link href="/" className="flex items-center gap-2.5 font-display text-[17px] font-bold">
            <CoinMark size={30} />
            <span>Tiktok Jetonlu Yayın Bulma</span>
          </Link>
          <button
            onClick={refresh}
            className="grid size-10 place-items-center rounded-full border border-line text-muted transition-colors hover:text-text"
            aria-label="Listeyi yenile"
            title="Listeyi yenile"
          >
            <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />
          </button>
        </header>

        {/* Açılış sahnesi */}
        <section className="hero-glow relative -mx-4 grid items-center gap-6 px-4 pt-6 pb-10 sm:-mx-6 sm:grid-cols-[1fr_auto] sm:px-6 sm:pt-12 sm:pb-14">
          <div className="order-2 sm:order-1">
            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55, type: "spring", stiffness: 140, damping: 18 }}
              className="font-display text-[44px] leading-[0.95] font-extrabold tracking-[-0.03em] text-balance sm:text-[72px]"
            >
              Tiktok Jetonlu Yayın Bulma
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.85, duration: 0.5 }}
              className="mt-5 max-w-md text-[17px] leading-relaxed text-muted"
            >
              Jeton dağıtılan canlı yayınlar burada. Bir yayın seç, butona bas, TikTok&apos;ta doğrudan aç.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 1.05, type: "spring", stiffness: 220, damping: 18 }}
              className="mt-6 inline-flex items-center gap-2.5 rounded-full border border-line bg-ink-2 px-4 py-2 text-[15px]"
            >
              {live.length > 0 ? (
                <>
                  <span className="live-dot" />
                  <span>
                    <b className="font-display tabular-nums">{live.length}</b> yayın şu an açık
                  </span>
                </>
              ) : (
                <span className="text-muted">Şu an açık yayın yok</span>
              )}
            </motion.div>
          </div>

          <motion.div
            className="order-1 justify-self-center sm:order-2"
            initial={{ y: -320, opacity: 0, scale: 0.6 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 120, damping: 11, mass: 1.1 }}
          >
            <div className="hidden sm:block">
              <SpinningCoin size={220} />
            </div>
            <div className="sm:hidden">
              <SpinningCoin size={120} />
            </div>
            <motion.div
              aria-hidden="true"
              className="mx-auto mt-6 h-3 w-2/3 rounded-[50%] bg-black/50 blur-md"
              initial={{ scaleX: 0.2, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{ delay: 0.35, duration: 0.5 }}
            />
          </motion.div>
        </section>

        {data.announcement && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.15 }}
            className="mb-6 flex items-start gap-3 rounded-xl border border-gold/30 bg-gold/10 px-4 py-3 text-[15px] text-gold-soft"
          >
            <Megaphone className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p>{data.announcement}</p>
          </motion.div>
        )}

        <motion.main
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2, type: "spring", stiffness: 160, damping: 22 }}
          className="flex-1 pb-16"
        >
          <div role="tablist" aria-label="Yayın listeleri" className="mb-5 flex gap-1 overflow-x-auto rounded-2xl border border-line bg-ink-2 p-1">
            {tabs.map((t) => {
              const active = tab === t.id;
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(t.id)}
                  className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2.5 py-2.5 text-[14px] sm:gap-2 sm:px-3 sm:text-[15px] font-semibold whitespace-nowrap transition-colors ${
                    active ? "text-ink" : "text-muted hover:text-text"
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="tab-pill"
                      className={`absolute inset-0 rounded-xl ${t.id === "live" ? "bg-gold" : t.id === "upcoming" ? "bg-cyan" : "bg-text"}`}
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    />
                  )}
                  <Icon className="relative size-4" aria-hidden="true" />
                  <span className="relative">
                    {t.label}
                    {t.id === "live" && <span className="hidden sm:inline"> yayınlar</span>}
                  </span>
                  <span className={`relative tabular-nums text-[13px] ${active ? "text-ink/70" : "text-muted"}`}>{t.count}</span>
                </button>
              );
            })}
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
              {tab === "live" &&
                (live.length ? (
                  <div className="space-y-3">
                    <AnimatePresence>
                      {live.map((s, i) => (
                        <LiveCard key={s.id} s={s} now={now} index={i} />
                      ))}
                    </AnimatePresence>
                  </div>
                ) : (
                  <EmptyState kind="live" />
                ))}

              {tab === "upcoming" &&
                (upcoming.length ? (
                  <div className="space-y-3">
                    {upcoming.map((s, i) => (
                      <UpcomingCard key={s.id} s={s} now={now} index={i} />
                    ))}
                  </div>
                ) : (
                  <EmptyState kind="upcoming" />
                ))}

              {tab === "past" &&
                (past.length ? (
                  <ul className="divide-y divide-line rounded-2xl border border-line bg-ink-2/50 px-4">
                    {past.map((s, i) => (
                      <PastRow key={s.id} s={s} now={now} index={i} />
                    ))}
                  </ul>
                ) : (
                  <EmptyState kind="past" />
                ))}
            </motion.div>
          </AnimatePresence>
        </motion.main>

        <footer className="flex flex-col gap-2 border-t border-line py-6 text-[13px] text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>Bu site TikTok ile bağlantılı değildir. Linkler TikTok&apos;ta açılır.</p>
          <Link href="/admin" className="hover:text-text">
            Yönetim
          </Link>
        </footer>
      </div>
    </MotionConfig>
  );
}
