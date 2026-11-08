"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarClock,
  CircleStop,
  Coins,
  History,
  Loader2,
  MousePointerClick,
  Pencil,
  Plus,
  Radio,
  RotateCcw,
  Star,
  TimerReset,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { PageHead, useAdmin } from "./AdminApp";
import StreamForm, { type StreamPayload } from "./StreamForm";
import { IconBtn, Menu, Panel } from "./ui";
import { endTime, formatAgo, formatCoins, formatDuration, splitStreams } from "@/lib/status";
import type { DB, Stream } from "@/lib/types";

type StreamsResp = DB & { clicks: Record<string, number> };

export default function StreamsTab() {
  const { state, setState, api, now } = useAdmin();
  const [editing, setEditing] = useState<Stream | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  function apply(r: StreamsResp | null) {
    if (!r) return false;
    setState((s) => ({ ...s, db: { streams: r.streams, settings: r.settings }, clicks: r.clicks ?? s.clicks }));
    return true;
  }

  const toBody = (p: StreamPayload) => ({ ...p, coins: p.coins === "" ? null : Number(p.coins) });

  async function create(p: StreamPayload) {
    return apply(await api<StreamsResp>("/api/streams", { method: "POST", body: JSON.stringify(toBody(p)) }, "Yayın eklendi"));
  }
  async function update(p: StreamPayload) {
    if (!editing) return false;
    const ok = apply(await api<StreamsResp>(`/api/streams/${editing.id}`, { method: "PATCH", body: JSON.stringify(toBody(p)) }, "Değişiklikler kaydedildi"));
    if (ok) setEditing(null);
    return ok;
  }
  async function act(s: Stream, body: object, okText: string) {
    setPending(s.id);
    apply(await api<StreamsResp>(`/api/streams/${s.id}`, { method: "PATCH", body: JSON.stringify(body) }, okText));
    setPending(null);
  }
  async function remove(s: Stream) {
    if (!confirm(`@${s.username} yayını silinsin mi? Bu geri alınamaz.`)) return;
    setPending(s.id);
    apply(await api<StreamsResp>(`/api/streams/${s.id}`, { method: "DELETE" }, "Yayın silindi"));
    setPending(null);
  }

  const { live, upcoming, past } = splitStreams(state.db.streams, now);
  const clicks = state.clicks;

  const rowProps = (s: Stream) => ({ s, busy: pending === s.id, clicks: clicks[s.id] ?? 0 });
  const featureItem = (s: Stream) => ({
    label: s.featured ? "Öne çıkarmayı kaldır" : "Öne çıkar",
    icon: Star,
    onClick: () => act(s, { action: "feature", value: !s.featured }, s.featured ? "Öne çıkarma kaldırıldı" : "Yayın öne çıkarıldı"),
  });

  return (
    <div>
      <PageHead title="Yayınlar" desc="Ana sayfada görünen yayınları ekle, süresini ayarla, öne çıkar ya da bitir." />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div>
          <Panel title={editing ? `@${editing.username} düzenleniyor` : "Yeni yayın ekle"} icon={editing ? Pencil : Plus} className="xl:sticky xl:top-6">
            <StreamForm key={editing?.id ?? "new"} editing={editing} onSubmit={editing ? update : create} onCancel={editing ? () => setEditing(null) : undefined} />
          </Panel>
        </div>

        <div className="space-y-6">
          <ListSection title="Aktif" icon={Radio} tone="text-live" count={live.length} empty="Şu an aktif yayın yok.">
            {live.map((s) => (
              <Row key={s.id} {...rowProps(s)} status={`${formatDuration(endTime(s) - now)} kaldı`} statusTone="text-live">
                <IconBtn label={s.featured ? "Öne çıkarmayı kaldır" : "Öne çıkar"} icon={Star} active={s.featured} onClick={featureItem(s).onClick} />
                <IconBtn label="Düzenle" icon={Pencil} onClick={() => setEditing(s)} />
                <Menu
                  items={[
                    { label: "15 dk uzat", icon: TimerReset, onClick: () => act(s, { action: "extend", minutes: 15 }, "15 dakika uzatıldı") },
                    { label: "30 dk uzat", icon: TimerReset, onClick: () => act(s, { action: "extend", minutes: 30 }, "30 dakika uzatıldı") },
                    { label: "1 saat uzat", icon: TimerReset, onClick: () => act(s, { action: "extend", minutes: 60 }, "1 saat uzatıldı") },
                    { label: "Şimdi bitir", icon: CircleStop, onClick: () => act(s, { action: "end" }, "Yayın bitirildi") },
                    { label: "Sil", icon: Trash2, danger: true, onClick: () => remove(s) },
                  ]}
                />
              </Row>
            ))}
          </ListSection>

          <ListSection title="Yaklaşan" icon={CalendarClock} tone="text-cyan" count={upcoming.length} empty="Planlanmış yayın yok.">
            {upcoming.map((s) => (
              <Row key={s.id} {...rowProps(s)} status={`${formatDuration(new Date(s.startsAt).getTime() - now)} sonra başlıyor`} statusTone="text-cyan">
                <IconBtn label={s.featured ? "Öne çıkarmayı kaldır" : "Öne çıkar"} icon={Star} active={s.featured} onClick={featureItem(s).onClick} />
                <IconBtn label="Düzenle" icon={Pencil} onClick={() => setEditing(s)} />
                <Menu
                  items={[
                    { label: "Şimdi başlat", icon: Radio, onClick: () => act(s, { startsAt: new Date().toISOString() }, "Yayın başlatıldı") },
                    { label: "Sil", icon: Trash2, danger: true, onClick: () => remove(s) },
                  ]}
                />
              </Row>
            ))}
          </ListSection>

          <ListSection title="Geçmiş" icon={History} tone="text-muted" count={past.length} empty="Henüz biten yayın yok.">
            {past.map((s) => (
              <Row key={s.id} {...rowProps(s)} status={`${formatAgo(now - endTime(s))} bitti`} statusTone="text-muted">
                <IconBtn label="1 saat daha yayınla" icon={RotateCcw} onClick={() => act(s, { action: "extend", minutes: 60 }, "Yayın 1 saatliğine tekrar aktif")} />
                <IconBtn label="Düzenle" icon={Pencil} onClick={() => setEditing(s)} />
                <IconBtn label="Sil" icon={Trash2} danger onClick={() => remove(s)} />
              </Row>
            ))}
          </ListSection>
        </div>
      </div>
    </div>
  );
}

function ListSection({
  title,
  icon: Icon,
  tone,
  count,
  empty,
  children,
}: {
  title: string;
  icon: LucideIcon;
  tone: string;
  count: number;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className={`mb-2 flex items-center gap-2 font-display text-[16px] font-bold ${tone}`}>
        <Icon className="size-4" aria-hidden="true" />
        {title}
        <span className="text-[13px] font-semibold text-muted tabular-nums">{count}</span>
      </h2>
      {count ? (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-ink-2">
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
  clicks,
  children,
}: {
  s: Stream;
  status: string;
  statusTone: string;
  busy: boolean;
  clicks: number;
  children: React.ReactNode;
}) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
          <a href={s.url} target="_blank" rel="noopener noreferrer" className="truncate font-semibold hover:text-gold">
            @{s.username}
          </a>
          {s.featured && <Star className="size-3.5 fill-gold text-gold" aria-label="Öne çıkan" />}
          {s.coins !== null && (
            <span className="inline-flex items-center gap-1 text-[13px] text-gold tabular-nums">
              <Coins className="size-3.5" aria-hidden="true" />
              {formatCoins(s.coins)}
            </span>
          )}
          <span className="inline-flex items-center gap-1 text-[13px] text-muted tabular-nums" title="Tıklama">
            <MousePointerClick className="size-3.5" aria-hidden="true" />
            {clicks}
          </span>
        </div>
        {s.title && <div className="truncate text-[14px] text-text/80">{s.title}</div>}
        <div className={`text-[13px] tabular-nums ${statusTone}`}>{status}</div>
      </div>
      <div className="flex items-center gap-0.5">{busy ? <Loader2 className="m-2 size-4 animate-spin text-muted" /> : children}</div>
    </motion.li>
  );
}
