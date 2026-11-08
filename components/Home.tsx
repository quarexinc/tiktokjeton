"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import {
  ArrowDownWideNarrow,
  Bell,
  BellOff,
  CalendarClock,
  ExternalLink,
  History,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Radio,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { CoinMark, SpinningCoin } from "./Coin";
import { EmptyState, LiveCard, PastRow, UpcomingCard } from "./StreamItems";
import { endTime, formatDuration, splitStreams } from "@/lib/status";
import type { PublicPayload } from "@/lib/public";
import type { Stream } from "@/lib/types";

type Tab = "live" | "upcoming" | "past";
type Sort = "new" | "coins" | "ending";
const POLL_MS = 30_000;

export type Viewer = {
  admin: boolean;
  member: { code: string; expiresAt: string | null; usesLeft: number | null } | null;
};

function store(key: string, value?: string): string | null {
  try {
    if (value === undefined) return localStorage.getItem(key);
    localStorage.setItem(key, value);
  } catch {}
  return null;
}

function chime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const notes = [880, 1318.5];
    notes.forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = f;
      const t = ctx.currentTime + i * 0.14;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.18, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.4);
    });
  } catch {}
}

export default function Home({ initial, viewer }: { initial: PublicPayload; viewer: Viewer }) {
  const [data, setData] = useState(initial);
  const [now, setNow] = useState(initial.now);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("new");
  const [alerts, setAlerts] = useState(false);
  const [fresh, setFresh] = useState<Stream[]>([]);
  const seenLive = useRef<Set<string>>(new Set(splitStreams(initial.streams, initial.now).live.map((s) => s.id)));

  useEffect(() => {
    setAlerts(store("tjyb_alerts") === "1");
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const alertsRef = useRef(alerts);
  alertsRef.current = alerts;

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const r = await fetch("/api/streams", { cache: "no-store" });
      if (r.status === 401) {
        window.location.reload();
        return;
      }
      if (!r.ok) return;
      const next: PublicPayload = await r.json();
      setData(next);
      const { live } = splitStreams(next.streams, Date.now());
      const added = live.filter((s) => !seenLive.current.has(s.id));
      live.forEach((s) => seenLive.current.add(s.id));
      if (added.length) {
        setFresh((f) => [...added, ...f].slice(0, 3));
        if (alertsRef.current) {
          chime();
          if (document.visibilityState === "hidden" && "Notification" in window && Notification.permission === "granted") {
            new Notification("Yeni jetonlu yayın", { body: added.map((s) => `@${s.username}`).join(", "), icon: "/icon.svg" });
          }
        }
      }
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const t = setInterval(refresh, POLL_MS);
    const onVis = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refresh]);

  // Aktif yayına geçince ilk listede olmayanları da "görüldü" say (zamanlanmış yayın başlayınca bildir)
  const split = useMemo(() => splitStreams(data.streams, now), [data.streams, now]);
  useEffect(() => {
    const added = split.live.filter((s) => !seenLive.current.has(s.id));
    if (!added.length) return;
    added.forEach((s) => seenLive.current.add(s.id));
    setFresh((f) => [...added, ...f].slice(0, 3));
    if (alertsRef.current) chime();
  }, [split.live]);

  useEffect(() => {
    document.title = split.live.length ? `(${split.live.length}) Tiktok Jetonlu Yayın Bulma` : "Tiktok Jetonlu Yayın Bulma";
  }, [split.live.length]);

  useEffect(() => {
    if (!fresh.length) return;
    const t = setTimeout(() => setFresh((f) => f.slice(0, -1)), 9000);
    return () => clearTimeout(t);
  }, [fresh]);

  async function toggleAlerts() {
    const next = !alerts;
    setAlerts(next);
    store("tjyb_alerts", next ? "1" : "0");
    if (next) {
      chime();
      if ("Notification" in window && Notification.permission === "default") {
        try {
          await Notification.requestPermission();
        } catch {}
      }
    }
  }

  async function logout() {
    await fetch("/api/member/logout", { method: "POST" });
    window.location.reload();
  }

  const q = query.trim().toLowerCase().replace(/^@/, "");
  const filter = (list: Stream[]) =>
    q ? list.filter((s) => s.username.toLowerCase().includes(q) || s.title.toLowerCase().includes(q)) : list;

  const live = useMemo(() => {
    const list = [...filter(split.live)];
    const cmp: Record<Sort, (a: Stream, b: Stream) => number> = {
      new: (a, b) => +new Date(b.startsAt) - +new Date(a.startsAt),
      coins: (a, b) => (b.coins ?? -1) - (a.coins ?? -1),
      ending: (a, b) => endTime(a) - endTime(b),
    };
    return list.sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || cmp[sort](a, b));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [split.live, q, sort]);
  const upcoming = filter(split.upcoming);
  const past = filter(split.past);

  const [tab, setTab] = useState<Tab>(() => {
    const s = splitStreams(initial.streams, initial.now);
    return s.live.length ? "live" : s.upcoming.length ? "upcoming" : "live";
  });

  const tabs: { id: Tab; label: string; count: number; icon: typeof Radio }[] = [
    { id: "live", label: "Aktif", count: live.length, icon: Radio },
    { id: "upcoming", label: "Yaklaşan", count: upcoming.length, icon: CalendarClock },
    ...(data.showPast ? [{ id: "past" as Tab, label: "Geçmiş", count: past.length, icon: History }] : []),
  ];

  const member = viewer.member;
  const memberLeft = member?.expiresAt ? new Date(member.expiresAt).getTime() - now : null;

  return (
    <MotionConfig reducedMotion="user">
      <div className="grain pointer-events-none fixed inset-0 z-0" aria-hidden="true" />
      <div className="relative z-10 mx-auto flex min-h-dvh max-w-4xl flex-col px-4 sm:px-6">
        <header className="flex items-center justify-between gap-3 py-5">
          <Link href="/" className="flex min-w-0 items-center gap-2.5 font-display text-[17px] font-bold">
            <CoinMark size={30} />
            <span className="truncate">Tiktok Jetonlu Yayın Bulma</span>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            {viewer.admin && (
              <Link
                href="/admin"
                className="hidden items-center gap-1.5 rounded-full border border-line px-3 py-2 text-[13px] font-semibold text-muted hover:text-text sm:inline-flex"
              >
                <LayoutDashboard className="size-3.5" aria-hidden="true" />
                Yönetim
              </Link>
            )}
            {member && (
              <span
                className="hidden items-center gap-1.5 rounded-full border border-line px-3 py-2 text-[13px] text-muted tabular-nums sm:inline-flex"
                title={member.code}
              >
                <KeyRound className="size-3.5 text-gold" aria-hidden="true" />
                {memberLeft === null ? "Süresiz üyelik" : `${formatDuration(memberLeft)} kaldı`}
              </span>
            )}
            <button
              onClick={toggleAlerts}
              className={`grid size-10 place-items-center rounded-full border transition-colors ${
                alerts ? "border-gold/50 bg-gold/10 text-gold" : "border-line text-muted hover:text-text"
              }`}
              aria-pressed={alerts}
              aria-label={alerts ? "Yeni yayın bildirimini kapat" : "Yeni yayın bildirimini aç"}
              title={alerts ? "Bildirim açık" : "Yeni yayın açılınca sesli bildir"}
            >
              {alerts ? <Bell className="size-4" aria-hidden="true" /> : <BellOff className="size-4" aria-hidden="true" />}
            </button>
            <button
              onClick={refresh}
              className="grid size-10 place-items-center rounded-full border border-line text-muted transition-colors hover:text-text"
              aria-label="Listeyi yenile"
              title="Listeyi yenile"
            >
              <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />
            </button>
            {member && (
              <button
                onClick={logout}
                className="grid size-10 place-items-center rounded-full border border-line text-muted transition-colors hover:text-live"
                aria-label="Çıkış yap"
                title="Çıkış yap"
              >
                <LogOut className="size-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </header>

        {/* Açılış sahnesi */}
        <section className="hero-glow relative -mx-4 grid items-center gap-6 px-4 pt-4 pb-10 sm:-mx-6 sm:grid-cols-[1fr_auto] sm:px-6 sm:pt-10 sm:pb-12">
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
              className="mt-6 flex flex-wrap items-center gap-2"
            >
              <span className="inline-flex items-center gap-2.5 rounded-full border border-line bg-ink-2 px-4 py-2 text-[15px]">
                {split.live.length > 0 ? (
                  <>
                    <span className="live-dot" />
                    <span>
                      <b className="font-display tabular-nums">{split.live.length}</b> yayın şu an açık
                    </span>
                  </>
                ) : (
                  <span className="text-muted">Şu an açık yayın yok</span>
                )}
              </span>
              {member && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-ink-2 px-3.5 py-2 text-[14px] text-muted tabular-nums sm:hidden">
                  <KeyRound className="size-3.5 text-gold" aria-hidden="true" />
                  {memberLeft === null ? "Süresiz" : `${formatDuration(memberLeft)} kaldı`}
                </span>
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
              <SpinningCoin size={110} />
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
          <div role="tablist" aria-label="Yayın listeleri" className="flex gap-1 overflow-x-auto rounded-2xl border border-line bg-ink-2 p-1">
            {tabs.map((t) => {
              const active = tab === t.id;
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(t.id)}
                  className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2.5 py-2.5 text-[14px] font-semibold whitespace-nowrap transition-colors sm:gap-2 sm:px-3 sm:text-[15px] ${
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

          <div className="mt-3 mb-5 flex gap-2">
            <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-line bg-ink-2 px-3 focus-within:border-gold">
              <Search className="size-4 shrink-0 text-muted" aria-hidden="true" />
              <span className="sr-only">Yayın ara</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Kullanıcı adı veya başlık ara"
                className="min-w-0 flex-1 bg-transparent py-2.5 text-[15px] outline-none placeholder:text-muted/70"
              />
              {query && (
                <button onClick={() => setQuery("")} className="text-muted hover:text-text" aria-label="Aramayı temizle">
                  <X className="size-4" />
                </button>
              )}
            </label>
            {tab === "live" && (
              <label className="flex items-center gap-2 rounded-xl border border-line bg-ink-2 pl-3 focus-within:border-gold">
                <ArrowDownWideNarrow className="size-4 text-muted" aria-hidden="true" />
                <span className="sr-only">Sırala</span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as Sort)}
                  className="bg-transparent py-2.5 pr-3 text-[14px] font-semibold text-text outline-none"
                >
                  <option value="new">En yeni</option>
                  <option value="coins">En çok jeton</option>
                  <option value="ending">Bitişi yakın</option>
                </select>
              </label>
            )}
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
                  <EmptyState kind="live" query={q ? query : undefined} />
                ))}

              {tab === "upcoming" &&
                (upcoming.length ? (
                  <div className="space-y-3">
                    {upcoming.map((s, i) => (
                      <UpcomingCard key={s.id} s={s} now={now} index={i} />
                    ))}
                  </div>
                ) : (
                  <EmptyState kind="upcoming" query={q ? query : undefined} />
                ))}

              {tab === "past" &&
                (past.length ? (
                  <ul className="divide-y divide-line rounded-2xl border border-line bg-ink-2/50 px-4">
                    {past.map((s, i) => (
                      <PastRow key={s.id} s={s} now={now} index={i} />
                    ))}
                  </ul>
                ) : (
                  <EmptyState kind="past" query={q ? query : undefined} />
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

      {/* Yeni yayın bildirimleri */}
      <div className="fixed inset-x-0 top-3 z-50 flex flex-col items-center gap-2 px-3" aria-live="polite">
        <AnimatePresence>
          {fresh.map((s) => (
            <motion.div
              key={s.id}
              layout
              initial={{ opacity: 0, y: -24, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ type: "spring", stiffness: 300, damping: 24 }}
              className="flex w-full max-w-md items-center gap-3 rounded-2xl border border-gold/40 bg-ink-2/95 p-3 pl-4 shadow-2xl backdrop-blur"
            >
              <span className="live-dot shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] text-muted">Yeni yayın açıldı</p>
                <p className="truncate font-semibold">@{s.username}</p>
              </div>
              <a
                href={`/go/${s.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl bg-gold px-3.5 py-2 text-[14px] font-bold text-ink hover:bg-gold-soft"
              >
                Yayına git
                <ExternalLink className="size-3.5" aria-hidden="true" />
              </a>
              <button
                onClick={() => setFresh((f) => f.filter((x) => x.id !== s.id))}
                className="grid size-8 place-items-center rounded-lg text-muted hover:text-text"
                aria-label="Kapat"
              >
                <X className="size-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
