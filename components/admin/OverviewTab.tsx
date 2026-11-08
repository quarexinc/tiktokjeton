"use client";

import { useEffect } from "react";
import {
  Activity,
  CalendarClock,
  KeyRound,
  LogIn,
  MousePointerClick,
  Plus,
  Radio,
  RefreshCw,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  TrendingUp,
  UserX,
  type LucideIcon,
} from "lucide-react";
import { PageHead, useAdmin } from "./AdminApp";
import { Bars, Panel, Stat } from "./ui";
import { splitStreams, formatAgo } from "@/lib/status";
import { keyStatus, sessionValid } from "@/lib/keys";
import type { LogEntry } from "@/lib/types";

const LOG_ICON: Record<LogEntry["type"], { icon: LucideIcon; tone: string }> = {
  member_login: { icon: LogIn, tone: "text-cyan" },
  member_fail: { icon: UserX, tone: "text-live" },
  admin_login: { icon: ShieldCheck, tone: "text-gold" },
  admin_fail: { icon: ShieldAlert, tone: "text-live" },
  key_created: { icon: KeyRound, tone: "text-gold" },
  key_updated: { icon: KeyRound, tone: "text-muted" },
  key_deleted: { icon: Trash2, tone: "text-live" },
  stream_added: { icon: Plus, tone: "text-gold" },
  stream_updated: { icon: Radio, tone: "text-muted" },
  stream_deleted: { icon: Trash2, tone: "text-live" },
  settings: { icon: Settings2, tone: "text-muted" },
};

export default function OverviewTab() {
  const { state, now, go, refreshOverview } = useAdmin();
  const { db, keys, overview } = state;

  useEffect(() => {
    refreshOverview();
    const t = setInterval(refreshOverview, 30_000);
    return () => clearInterval(t);
  }, [refreshOverview]);

  const { live, upcoming } = splitStreams(db.streams, now);
  const activeKeys = keys.filter((k) => k.activatedAt && sessionValid(k, now)).length;
  const unusedKeys = keys.filter((k) => keyStatus(k, now) === "unused").length;
  const today = overview.loginsByDay.at(-1)?.count ?? 0;
  const todayClicks = overview.clicksByDay.at(-1)?.count ?? 0;
  const week = overview.loginsByDay.slice(-7).reduce((a, b) => a + b.count, 0);
  const totalClicks = Object.values(overview.clicks).reduce((a, b) => a + b, 0);

  const top = db.streams
    .map((s) => ({ s, c: overview.clicks[s.id] ?? 0 }))
    .filter((x) => x.c > 0)
    .sort((a, b) => b.c - a.c)
    .slice(0, 6);
  const topMax = Math.max(1, ...top.map((t) => t.c));

  return (
    <div>
      <PageHead
        title="Genel bakış"
        desc="Sitenin şu anki durumu, üye girişleri ve en çok tıklanan yayınlar."
        action={
          <div className="flex gap-2">
            <button onClick={() => go("streams")} className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2.5 font-semibold text-ink hover:bg-gold-soft">
              <Plus className="size-4" aria-hidden="true" />
              Yayın ekle
            </button>
            <button onClick={() => go("keys")} className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 font-semibold text-muted hover:text-text">
              <KeyRound className="size-4" aria-hidden="true" />
              Anahtar oluştur
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat icon={Radio} label="Aktif yayın" value={live.length} hint={`${upcoming.length} yaklaşan`} tone="text-live" />
        <Stat icon={KeyRound} label="Aktif üye" value={activeKeys} hint={`${unusedKeys} kullanılmamış anahtar`} tone="text-gold" />
        <Stat icon={LogIn} label="Bugün giriş" value={today} hint={`Son 7 gün: ${week}`} tone="text-cyan" />
        <Stat icon={MousePointerClick} label="Bugün tıklama" value={todayClicks} hint={`Toplam: ${totalClicks.toLocaleString("tr-TR")}`} tone="text-text" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel title="Üye girişleri" icon={TrendingUp} action={<span className="text-[13px] text-muted">Son 14 gün</span>}>
          <Bars data={overview.loginsByDay} tone="bg-cyan" />
          <DayAxis days={overview.loginsByDay.map((d) => d.day)} />
        </Panel>
        <Panel title="Yayın tıklamaları" icon={MousePointerClick} action={<span className="text-[13px] text-muted">Son 14 gün</span>}>
          <Bars data={overview.clicksByDay} tone="bg-gold" />
          <DayAxis days={overview.clicksByDay.map((d) => d.day)} />
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1.2fr]">
        <Panel title="En çok tıklanan yayınlar" icon={TrendingUp}>
          {top.length ? (
            <ul className="space-y-3">
              {top.map(({ s, c }) => (
                <li key={s.id}>
                  <div className="flex items-baseline justify-between gap-3 text-[14px]">
                    <span className="truncate font-semibold">@{s.username}</span>
                    <span className="shrink-0 text-muted tabular-nums">{c.toLocaleString("tr-TR")} tıklama</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-ink-3">
                    <div className="h-full rounded-full bg-gradient-to-r from-live to-gold" style={{ width: `${(c / topMax) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[14px] text-muted">Üyeler &quot;Yayına git&quot; butonuna bastıkça burada sıralanır.</p>
          )}
        </Panel>

        <Panel
          title="Son etkinlikler"
          icon={Activity}
          action={
            <button onClick={refreshOverview} className="grid size-8 place-items-center rounded-lg text-muted hover:text-text" aria-label="Yenile">
              <RefreshCw className="size-4" />
            </button>
          }
        >
          {overview.log.length ? (
            <ul className="max-h-[420px] space-y-0.5 overflow-y-auto pr-1">
              {overview.log.slice(0, 40).map((e, i) => {
                const m = LOG_ICON[e.type] ?? { icon: Activity, tone: "text-muted" };
                return (
                  <li key={i} className="flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-ink-3/50">
                    <m.icon className={`mt-0.5 size-4 shrink-0 ${m.tone}`} aria-hidden="true" />
                    <span className="min-w-0 flex-1 text-[14px] break-words">{e.msg}</span>
                    <span className="shrink-0 text-[12px] text-muted tabular-nums">{formatAgo(now - new Date(e.t).getTime())}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="flex items-center gap-2 text-[14px] text-muted">
              <CalendarClock className="size-4" aria-hidden="true" />
              Henüz kayıtlı etkinlik yok.
            </p>
          )}
        </Panel>
      </div>
    </div>
  );
}

function DayAxis({ days }: { days: string[] }) {
  const fmt = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
  return (
    <div className="mt-2 flex justify-between text-[11px] text-muted">
      <span>{fmt(days[0])}</span>
      <span>Bugün</span>
    </div>
  );
}
