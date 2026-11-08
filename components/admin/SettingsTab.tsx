"use client";

import { useState } from "react";
import { Database, History, KeyRound, Loader2, Megaphone, Save, ShieldCheck, Wrench } from "lucide-react";
import { PageHead, useAdmin } from "./AdminApp";
import { Panel, Toggle, field } from "./ui";
import type { DB, Settings } from "@/lib/types";

const STORAGE_TEXT = {
  redis: { label: "Upstash Redis bağlı", ok: true },
  blob: { label: "Vercel Blob bağlı", ok: true },
  local: { label: "Yerel dosya (geliştirme)", ok: true },
  none: { label: "Depolama bağlı değil", ok: false },
};

function Row({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <div>
        <div className="text-[15px] font-semibold">{title}</div>
        {desc && <div className="mt-0.5 text-[13px] text-muted">{desc}</div>}
      </div>
      {children}
    </div>
  );
}

export default function SettingsTab() {
  const { state, setState, api } = useAdmin();
  const [s, setS] = useState<Settings>(state.db.settings);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((x) => ({ ...x, [k]: v }));
  const dirty = JSON.stringify(s) !== JSON.stringify(state.db.settings);

  async function save() {
    setBusy(true);
    const r = await api<DB & { clicks: Record<string, number> }>("/api/settings", { method: "PUT", body: JSON.stringify(s) }, "Ayarlar kaydedildi");
    if (r) {
      setState((st) => ({ ...st, db: { streams: r.streams, settings: r.settings } }));
      setS(r.settings);
    }
    setBusy(false);
  }

  const storage = STORAGE_TEXT[state.overview.storage];

  return (
    <div>
      <PageHead
        title="Ayarlar"
        desc="Siteye giriş kuralları, ana sayfa görünümü ve bakım modu."
        action={
          <button
            onClick={save}
            disabled={busy || !dirty}
            className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-3 font-display font-bold text-ink transition-colors hover:bg-gold-soft disabled:opacity-40"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Ayarları kaydet
          </button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Giriş" icon={KeyRound}>
          <div className="divide-y divide-line">
            <Row title="Anahtar zorunlu" desc="Kapalıysa herkes yayınları anahtarsız görür.">
              <Toggle on={s.requireKey} onChange={(v) => set("requireKey", v)} label="Anahtar zorunlu" />
            </Row>
          </div>
          <div className="mt-2 space-y-3">
            <label className="block">
              <span className="mb-1.5 block text-[14px] font-semibold">Anahtar alma linki</span>
              <input
                value={s.contactUrl}
                onChange={(e) => set("contactUrl", e.target.value)}
                placeholder="https://t.me/kullaniciadi"
                className={field}
              />
              <span className="mt-1 block text-[13px] text-muted">Giriş ekranında &quot;Anahtarın yok mu?&quot; altında buton olarak çıkar. Telegram, Instagram, WhatsApp linki olabilir.</span>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[14px] font-semibold">Buton yazısı</span>
              <input value={s.contactLabel} onChange={(e) => set("contactLabel", e.target.value)} maxLength={40} placeholder="Anahtar al" className={field} />
            </label>
          </div>
        </Panel>

        <Panel title="Ana sayfa" icon={Megaphone}>
          <label className="block">
            <span className="mb-1.5 block text-[14px] font-semibold">Duyuru</span>
            <input
              value={s.announcement}
              onChange={(e) => set("announcement", e.target.value)}
              maxLength={200}
              placeholder="Yayın listesinin üstünde görünür. Boşsa gizlenir."
              className={field}
            />
          </label>
          <div className="mt-2 divide-y divide-line">
            <Row title="Geçmiş yayınları göster" desc="Kapalıysa Geçmiş sekmesi görünmez.">
              <Toggle on={s.showPast} onChange={(v) => set("showPast", v)} label="Geçmiş yayınları göster" />
            </Row>
            <Row title="Geçmişte gösterilecek yayın sayısı" desc="En son bitenler gösterilir.">
              <input
                type="number"
                min={0}
                max={200}
                value={s.pastLimit}
                onChange={(e) => set("pastLimit", Number(e.target.value))}
                className="w-24 rounded-xl border border-line bg-ink px-3 py-2.5 text-[15px] tabular-nums outline-none focus:border-gold"
              />
            </Row>
          </div>
        </Panel>

        <Panel title="Bakım modu" icon={Wrench}>
          <div className="divide-y divide-line">
            <Row title="Siteyi bakıma al" desc="Açıkken üyeler yayınları göremez, sen admin olarak görmeye devam edersin.">
              <Toggle on={s.maintenance} onChange={(v) => set("maintenance", v)} label="Bakım modu" />
            </Row>
          </div>
          <label className="mt-2 block">
            <span className="mb-1.5 block text-[14px] font-semibold">Bakım mesajı</span>
            <input value={s.maintenanceText} onChange={(e) => set("maintenanceText", e.target.value)} maxLength={200} className={field} />
          </label>
        </Panel>

        <Panel title="Sistem" icon={Database}>
          <div className="divide-y divide-line">
            <Row title="Depolama" desc={storage.ok ? "Yayınlar, anahtarlar ve istatistikler burada tutulur." : "Vercel projesinde Storage sekmesinden Upstash Redis bağla ve yeniden yayınla."}>
              <span className={`shrink-0 rounded-full px-3 py-1 text-[13px] font-semibold whitespace-nowrap ${storage.ok ? "bg-cyan/15 text-cyan" : "bg-live/15 text-live"}`}>{storage.label}</span>
            </Row>
            <Row title="Admin anahtarı" desc="Vercel proje ayarlarında ADMIN_KEY ortam değişkeninden değiştirilir.">
              <ShieldCheck className="size-5 text-cyan" aria-hidden="true" />
            </Row>
            <Row title="Etkinlik kaydı" desc="Son 300 olay saklanır, Genel bakış sayfasında görünür.">
              <History className="size-5 text-muted" aria-hidden="true" />
            </Row>
          </div>
        </Panel>
      </div>
    </div>
  );
}
