"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarClock,
  CircleStop,
  Coins,
  ExternalLink,
  History,
  Loader2,
  LogOut,
  Megaphone,
  Pencil,
  Plus,
  Radio,
  RotateCcw,
  Save,
  Settings2,
  TimerReset,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { CoinMark } from "../Coin";
import StreamForm, { type StreamPayload } from "./StreamForm";
import { endTime, formatAgo, formatCoins, formatDuration, splitStreams } from "@/lib/status";
import type { DB, Stream } from "@/lib/types";

type State = DB & { now: number };
type Toast = { id: number; text: string; tone: "ok" | "err" };

export default function Dashboard({ initial, storageError }: { initial: State; storageError: string | null }) {
  const [db, setDb] = useState<State>(initial);
  const [now, setNow] = useState(initial.now);
  const [editing, setEditing] = useState<Stream | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  function toast(text: string, tone: Toast["tone"] = "ok") {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }

  async function call(url: string, init: RequestInit, okText: string): Promise<boolean> {
    try {
      const r = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
      const j = await r.json().catch(() => ({}));
      if (r.status === 401) {
        toast("Oturum süresi doldu. Tekrar giriş yap.", "err");
        setTimeout(() => window.location.reload(), 1200);
        return false;
      }
      if (!r.ok) {
        toast(j.error ?? "İşlem tamamlanamadı.", "err");
        return false;
      }
      setDb(j);
      toast(okText);
      return true;
    } catch {
      toast("Sunucuya ulaşılamadı.", "err");
      return false;
    }
  }

  function toBody(p: StreamPayload) {
    return {
      username: p.username,
      url: p.url,
      title: p.title,
      coins: p.coins === "" ? null : Number(p.coins),
      note: p.note,
      startsAt: p.startsAt,
      durationMin: p.durationMin,
    };
  }

  async function create(p: StreamPayload) {
    return call("/api/streams", { method: "POST", body: JSON.stringify(toBody(p)) }, "Yayın eklendi");
  }

  async function update(p: StreamPayload) {
    if (!editing) return false;
    const ok = await call(`/api/streams/${editing.id}`, { method: "PATCH", body: JSON.stringify(toBody(p)) }, "Değişiklikler kaydedildi");
    if (ok) setEditing(null);
    return ok;
  }

  async function act(s: Stream, body: object, okText: string) {
    setPending(s.id);
    await call(`/api/streams/${s.id}`, { method: "PATCH", body: JSON.stringify(body) }, okText);
    setPending(null);
  }

  async function remove(s: Stream) {
    if (!confirm(`@${s.username} yayını silinsin mi? Bu geri alınamaz.`)) return;
    setPending(s.id);
    await call(`/api/streams/${s.id}`, { method: "DELETE" }, "Yayın silindi");
    setPending(null);
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    window.location.reload();
  }

  const { live, upcoming, past } = useMemo(() => splitStreams(db.streams, now), [db.streams, now]);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3 py-5">
        <div className="flex items-center gap-2.5">
          <CoinMark size={30} />
          <div>
            <div className="font-display text-[17px] leading-tight font-bold">Yönetim paneli</div>
            <div className="text-[13px] text-muted">Tiktok Jetonlu Yayın Bulma</div>
          </div>
        </div>
        <div className="flex gap-2">
          <a href="/" target="_blank" className="inline-flex items-center gap-2 rounded-xl border border-line px-3.5 py-2 text-[14px] font-semibold text-muted hover:text-text">
            <ExternalLink className="size-4" aria-hidden="true" />
            Siteyi aç
          </a>
          <button onClick={logout} className="inline-flex items-center gap-2 rounded-xl border border-line px-3.5 py-2 text-[14px] font-semibold text-muted hover:text-text">
            <LogOut className="size-4" aria-hidden="true" />
            Çıkış
          </button>
        </div>
      </header>

      {storageError && (
        <div className="mb-6 flex gap-3 rounded-xl border border-live/40 bg-live/10 p-4 text-[14px]">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-live" aria-hidden="true" />
          <p>{storageError}</p>
        </div>
      )}

      <div className="mb-6 grid grid-cols-3 gap-3">
        <Stat icon={Radio} label="Aktif" value={live.length} tone="text-live" />
        <Stat icon={CalendarClock} label="Yaklaşan" value={upcoming.length} tone="text-cyan" />
        <Stat icon={History} label="Geçmiş" value={past.length} tone="text-muted" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="space-y-6">
          <Panel title={editing ? `@${editing.username} düzenleniyor` : "Yeni yayın ekle"} icon={editing ? Pencil : Plus}>
            <StreamForm
              key={editing?.id ?? "new"}
              editing={editing}
              onSubmit={editing ? update : create}
              onCancel={editing ? () => setEditing(null) : undefined}
            />
          </Panel>
          <SettingsPanel db={db} onSave={(s) => call("/api/settings", { method: "PUT", body: JSON.stringify(s) }, "Ayarlar kaydedildi")} />
        </div>

        <div className="space-y-6">
          <ListSection title="Aktif yayınlar" icon={Radio} tone="text-live" empty="Şu an aktif yayın yok.">
            {live.map((s) => (
              <Row key={s.id} s={s} busy={pending === s.id} status={`${formatDuration(endTime(s) - now)} kaldı`} statusTone="text-live">
                <IconBtn label="Düzenle" icon={Pencil} onClick={() => setEditing(s)} />
                <IconBtn label="30 dk uzat" icon={TimerReset} onClick={() => act(s, { action: "extend", minutes: 30 }, "30 dakika uzatıldı")} />
                <IconBtn label="Şimdi bitir" icon={CircleStop} onClick={() => act(s, { action: "end" }, "Yayın bitirildi")} />
                <IconBtn label="Sil" icon={Trash2} danger onClick={() => remove(s)} />
              </Row>
            ))}
          </ListSection>

          <ListSection title="Yaklaşan" icon={CalendarClock} tone="text-cyan" empty="Planlanmış yayın yok.">
            {upcoming.map((s) => (
              <Row key={s.id} s={s} busy={pending === s.id} status={`${formatDuration(new Date(s.startsAt).getTime() - now)} sonra başlıyor`} statusTone="text-cyan">
                <IconBtn label="Düzenle" icon={Pencil} onClick={() => setEditing(s)} />
                <IconBtn label="Sil" icon={Trash2} danger onClick={() => remove(s)} />
              </Row>
            ))}
          </ListSection>

          <ListSection title="Geçmiş" icon={History} tone="text-muted" empty="Henüz biten yayın yok.">
            {past.map((s) => (
              <Row key={s.id} s={s} busy={pending === s.id} status={`${formatAgo(now - endTime(s))} bitti`} statusTone="text-muted">
                <IconBtn label="1 saat daha yayınla" icon={RotateCcw} onClick={() => act(s, { action: "extend", minutes: 60 }, "Yayın 1 saatliğine tekrar aktif")} />
                <IconBtn label="Düzenle" icon={Pencil} onClick={() => setEditing(s)} />
                <IconBtn label="Sil" icon={Trash2} danger onClick={() => remove(s)} />
              </Row>
            ))}
          </ListSection>
        </div>
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
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone }: { icon: typeof Radio; label: string; value: number; tone: string }) {
  return (
    <div className="rounded-2xl border border-line bg-ink-2 px-4 py-3">
      <div className={`flex items-center gap-1.5 text-[13px] ${tone}`}>
        <Icon className="size-3.5" aria-hidden="true" />
        {label}
      </div>
      <div className="mt-1 font-display text-3xl font-extrabold tabular-nums">{value}</div>
    </div>
  );
}

function Panel({ title, icon: Icon, children }: { title: string; icon: typeof Radio; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-ink-2 p-4 sm:p-5">
      <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold">
        <Icon className="size-4 text-gold" aria-hidden="true" />
        {title}
      </h2>
      {children}
    </section>
  );
}

function ListSection({
  title,
  icon: Icon,
  tone,
  empty,
  children,
}: {
  title: string;
  icon: typeof Radio;
  tone: string;
  empty: string;
  children: React.ReactNode[];
}) {
  return (
    <section>
      <h2 className={`mb-2 flex items-center gap-2 font-display text-[16px] font-bold ${tone}`}>
        <Icon className="size-4" aria-hidden="true" />
        {title}
        <span className="text-[13px] font-semibold text-muted tabular-nums">{children.length}</span>
      </h2>
      {children.length ? (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-ink-2">
          <AnimatePresence initial={false}>{children}</AnimatePresence>
        </ul>
      ) : (
        <p className="rounded-2xl border border-dashed border-line px-4 py-5 text-[14px] text-muted">{empty}</p>
      )}
    </section>
  );
}

function Row({
  s,
  status,
  statusTone,
  busy,
  children,
}: {
  s: Stream;
  status: string;
  statusTone: string;
  busy: boolean;
  children: React.ReactNode;
}) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <a href={s.url} target="_blank" rel="noopener noreferrer" className="truncate font-semibold hover:text-gold">
            @{s.username}
          </a>
          {s.coins !== null && (
            <span className="inline-flex items-center gap-1 text-[13px] text-gold tabular-nums">
              <Coins className="size-3.5" aria-hidden="true" />
              {formatCoins(s.coins)}
            </span>
          )}
        </div>
        {s.title && <div className="truncate text-[14px] text-text/80">{s.title}</div>}
        <div className={`text-[13px] tabular-nums ${statusTone}`}>{status}</div>
      </div>
      <div className="flex items-center gap-1">
        {busy ? <Loader2 className="m-2 size-4 animate-spin text-muted" /> : children}
      </div>
    </motion.li>
  );
}

function IconBtn({
  label,
  icon: Icon,
  onClick,
  danger,
}: {
  label: string;
  icon: typeof Radio;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`grid size-9 place-items-center rounded-lg border border-transparent text-muted transition-colors hover:border-line ${
        danger ? "hover:text-live" : "hover:text-text"
      }`}
    >
      <Icon className="size-4" aria-hidden="true" />
    </button>
  );
}

function SettingsPanel({ db, onSave }: { db: DB; onSave: (s: DB["settings"]) => Promise<boolean> }) {
  const [announcement, setAnnouncement] = useState(db.settings.announcement);
  const [showPast, setShowPast] = useState(db.settings.showPast);
  const [pastLimit, setPastLimit] = useState(String(db.settings.pastLimit));
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    await onSave({ announcement, showPast, pastLimit: Number(pastLimit) || 0 });
    setBusy(false);
  }

  return (
    <Panel title="Site ayarları" icon={Settings2}>
      <form onSubmit={save} className="space-y-4">
        <label className="block">
          <span className="mb-1.5 flex items-center gap-1.5 text-[14px] font-semibold">
            <Megaphone className="size-3.5 text-gold" aria-hidden="true" />
            Duyuru
          </span>
          <input
            value={announcement}
            onChange={(e) => setAnnouncement(e.target.value)}
            maxLength={200}
            placeholder="Ana sayfanın üstünde görünür. Boş bırakırsan gizlenir."
            className="w-full rounded-xl border border-line bg-ink px-3.5 py-3 text-[15px] outline-none placeholder:text-muted/60 focus:border-gold"
          />
        </label>

        <label className="flex cursor-pointer items-center justify-between gap-4">
          <span>
            <span className="block text-[14px] font-semibold">Geçmiş yayınları göster</span>
            <span className="block text-[13px] text-muted">Kapalıysa ana sayfada Geçmiş sekmesi görünmez.</span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={showPast}
            onClick={() => setShowPast((v) => !v)}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${showPast ? "bg-gold" : "bg-ink-3"}`}
          >
            <motion.span layout className={`absolute top-1 size-5 rounded-full bg-text ${showPast ? "right-1" : "left-1"}`} />
          </button>
        </label>

        <label className="flex items-center justify-between gap-4">
          <span>
            <span className="block text-[14px] font-semibold">Geçmişte gösterilecek yayın sayısı</span>
            <span className="block text-[13px] text-muted">En son bitenler gösterilir.</span>
          </span>
          <input
            type="number"
            min={0}
            max={200}
            value={pastLimit}
            onChange={(e) => setPastLimit(e.target.value)}
            className="w-24 rounded-xl border border-line bg-ink px-3 py-2.5 text-[15px] tabular-nums outline-none focus:border-gold"
          />
        </label>

        <button
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl border border-gold px-5 py-3 font-semibold text-gold transition-colors hover:bg-gold hover:text-ink disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Ayarları kaydet
        </button>
      </form>
    </Panel>
  );
}
