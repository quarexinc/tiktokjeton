"use client";

import { motion } from "framer-motion";
import { CalendarClock, Clock3, Coins, Eye, ExternalLink, Gift, History, Star, UserRound } from "lucide-react";
import { CoinMark } from "./Coin";
import { endTime, formatAgo, formatCoins, formatDuration, profileUrl } from "@/lib/status";
import type { Stream } from "@/lib/types";

function Avatar({ name }: { name: string }) {
  return (
    <span
      aria-hidden="true"
      className="grid size-9 shrink-0 place-items-center rounded-full border border-line bg-ink-3 font-display text-[15px] font-bold text-gold"
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function CoinBlock({ coins, dim = false }: { coins: number | null; dim?: boolean }) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl px-4 py-3 sm:w-40 sm:flex-col sm:items-start sm:justify-center sm:gap-1.5 sm:py-4 ${
        dim ? "bg-ink-3/60" : "bg-gradient-to-br from-gold/15 to-gold/5 ring-1 ring-gold/25"
      }`}
    >
      <CoinMark size={34} />
      {coins !== null ? (
        <div className="leading-none">
          <div className="font-display text-[28px] font-extrabold tracking-tight text-gold tabular-nums">
            {formatCoins(coins)}
          </div>
          <div className="mt-1 text-[13px] text-muted">jeton</div>
        </div>
      ) : (
        <div className="text-[15px] font-semibold text-gold-soft">Jetonlu yayın</div>
      )}
    </div>
  );
}

function ChestInfo({ s, now }: { s: Stream; now: number }) {
  const chests = s.chests ?? 0;
  const next = s.nextChestAt ? new Date(s.nextChestAt).getTime() - now : null;
  if (!chests && s.viewers == null) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-[13px]">
      {chests > 0 && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gold/15 px-2.5 py-1 font-semibold text-gold-soft">
          <Gift className="size-3.5" aria-hidden="true" />
          {chests} sandık
        </span>
      )}
      {chests > 0 && next !== null && (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 px-2.5 py-1 font-semibold text-gold tabular-nums">
          <Clock3 className="size-3.5" aria-hidden="true" />
          {next > 0 ? `Sonraki sandık ${formatDuration(next)}` : "Sandık açılıyor"}
        </span>
      )}
      {s.viewers != null && s.viewers > 0 && (
        <span className="inline-flex items-center gap-1.5 text-muted tabular-nums">
          <Eye className="size-3.5" aria-hidden="true" />
          {s.viewers.toLocaleString("tr-TR")} izleyici
        </span>
      )}
    </div>
  );
}

const enter = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8, transition: { duration: 0.15 } },
};

export function LiveCard({ s, now, index }: { s: Stream; now: number; index: number }) {
  const start = new Date(s.startsAt).getTime();
  const end = endTime(s);
  const left = end - now;
  const pct = Math.max(0, Math.min(100, (left / (end - start)) * 100));

  return (
    <motion.article
      layout
      {...enter}
      transition={{ delay: index * 0.06, type: "spring", stiffness: 260, damping: 26 }}
      className={`relative flex flex-col gap-4 overflow-hidden rounded-2xl border p-4 sm:flex-row sm:items-stretch sm:p-5 ${
        s.featured ? "border-gold/60 bg-gradient-to-br from-gold/[0.09] to-ink-2 shadow-[0_0_0_1px_rgba(247,201,72,0.15),0_18px_50px_-20px_rgba(247,201,72,0.35)]" : "border-line bg-ink-2"
      }`}
    >
      <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 ${s.featured ? "bg-gold" : "bg-live"}`} />
      <CoinBlock coins={s.coins} />

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex items-center gap-3">
          <Avatar name={s.username} />
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold">@{s.username}</div>
            <div className="flex items-center gap-2 text-[13px] text-live">
              <span className="live-dot" />
              Canlı
            </div>
          </div>
          {s.featured && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gold px-2.5 py-1 text-[12px] font-bold text-ink">
              <Star className="size-3 fill-current" aria-hidden="true" />
              Öne çıkan
            </span>
          )}
        </div>

        {s.title && <h3 className="font-display text-xl leading-snug font-bold text-balance">{s.title}</h3>}
        {s.note && <p className="max-w-prose text-[15px] leading-relaxed text-muted">{s.note}</p>}
        <ChestInfo s={s} now={now} />

        <div className="mt-auto space-y-1.5">
          <div className="time-track" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Ana sayfada kalan süre">
            <div className="time-fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex items-center gap-1.5 text-[13px] text-muted tabular-nums">
            <Clock3 className="size-3.5" aria-hidden="true" />
            {formatDuration(left)} kaldı
          </div>
        </div>
      </div>

      <a
        href={`/go/${s.id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="group inline-flex items-center justify-center gap-2 rounded-xl bg-gold px-5 py-3.5 font-display text-[17px] font-bold text-ink transition-colors hover:bg-gold-soft active:scale-[0.98] sm:self-center"
      >
        Yayına git
        <ExternalLink className="size-[18px] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
      </a>
    </motion.article>
  );
}

export function UpcomingCard({ s, now, index }: { s: Stream; now: number; index: number }) {
  const start = new Date(s.startsAt).getTime();
  const startLabel = new Date(start).toLocaleString("tr-TR", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <motion.article
      layout
      {...enter}
      transition={{ delay: index * 0.06, type: "spring", stiffness: 260, damping: 26 }}
      className="flex flex-col gap-4 rounded-2xl border border-dashed border-line bg-ink-2/60 p-4 sm:flex-row sm:items-center sm:p-5"
    >
      <CoinBlock coins={s.coins} dim />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-center gap-3">
          <Avatar name={s.username} />
          <div className="min-w-0">
            <div className="truncate font-semibold">@{s.username}</div>
            <div className="flex items-center gap-1.5 text-[13px] text-cyan">
              <CalendarClock className="size-3.5" aria-hidden="true" />
              {startLabel}
            </div>
          </div>
        </div>
        {s.title && <h3 className="font-display text-lg leading-snug font-bold text-balance">{s.title}</h3>}
        {s.note && <p className="max-w-prose text-[15px] leading-relaxed text-muted">{s.note}</p>}
        <p className="text-[13px] text-muted tabular-nums">{formatDuration(start - now)} sonra başlıyor</p>
      </div>
      <a
        href={`/go/${s.id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-line px-5 py-3 font-semibold text-text transition-colors hover:border-cyan hover:text-cyan"
      >
        Yayın linki
        <ExternalLink className="size-4" aria-hidden="true" />
      </a>
    </motion.article>
  );
}

export function PastRow({ s, now, index }: { s: Stream; now: number; index: number }) {
  return (
    <motion.li
      layout
      {...enter}
      transition={{ delay: Math.min(index, 10) * 0.03, duration: 0.25 }}
      className="flex items-center gap-3 py-3"
    >
      <Avatar name={s.username} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="truncate font-semibold">@{s.username}</span>
          {s.coins !== null && (
            <span className="inline-flex items-center gap-1 text-[13px] text-gold/80 tabular-nums">
              <Coins className="size-3.5" aria-hidden="true" />
              {formatCoins(s.coins)}
            </span>
          )}
        </div>
        <div className="truncate text-[13px] text-muted">
          {s.title ? `${s.title}, ` : ""}
          {formatAgo(now - endTime(s))} bitti
        </div>
      </div>
      <a
        href={profileUrl(s.username)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-[13px] font-semibold text-muted transition-colors hover:border-text hover:text-text"
      >
        <UserRound className="size-3.5" aria-hidden="true" />
        Profil
      </a>
    </motion.li>
  );
}

export function EmptyState({ kind, query }: { kind: "live" | "upcoming" | "past"; query?: string }) {
  const text = query
    ? { title: "Aramana uyan yayın yok", body: `"${query}" için sonuç bulunamadı. Başka bir kullanıcı adı dene.` }
    : {
    live: {
      title: "Şu an açık jetonlu yayın yok",
      body: "Sayfa kendini 30 saniyede bir yeniler. Yeni yayın eklendiğinde burada belirir.",
    },
    upcoming: {
      title: "Planlanmış yayın yok",
      body: "İleri tarihli yayınlar eklendiğinde başlama saatleriyle burada görünür.",
    },
    past: {
      title: "Henüz biten yayın yok",
      body: "Süresi dolan yayınlar buraya taşınır.",
    },
  }[kind];
  const Icon = kind === "past" ? History : kind === "upcoming" ? CalendarClock : Coins;
  return (
    <motion.div {...enter} className="flex flex-col items-center rounded-2xl border border-dashed border-line px-6 py-14 text-center">
      <Icon className="size-8 text-muted" aria-hidden="true" />
      <p className="mt-4 font-display text-lg font-bold">{text.title}</p>
      <p className="mt-1 max-w-sm text-[15px] text-muted">{text.body}</p>
    </motion.div>
  );
}
