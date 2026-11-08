"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Ban,
  CalendarPlus,
  Check,
  CircleCheck,
  Copy,
  Download,
  KeyRound,
  Loader2,
  LogOut,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Ticket,
  Trash2,
  X,
} from "lucide-react";
import { PageHead, useAdmin } from "./AdminApp";
import { Chips, IconBtn, Menu, Panel, field } from "./ui";
import { durationLabel, keyStatus, STATUS_LABEL } from "@/lib/keys";
import { formatAgo, formatDuration } from "@/lib/status";
import type { KeyStatus, MemberKey } from "@/lib/types";

type KeysResp = { keys: MemberKey[]; created?: MemberKey[] };

const USE_OPTIONS: { value: number | null; label: string }[] = [
  { value: 1, label: "1" },
  { value: 3, label: "3" },
  { value: 5, label: "5" },
  { value: 10, label: "10" },
  { value: 50, label: "50" },
  { value: null, label: "Sınırsız" },
];
const DAY_OPTIONS: { value: number | null; label: string }[] = [
  { value: 1, label: "1 gün" },
  { value: 3, label: "3 gün" },
  { value: 7, label: "1 hafta" },
  { value: 15, label: "15 gün" },
  { value: 30, label: "1 ay" },
  { value: 90, label: "3 ay" },
  { value: 365, label: "1 yıl" },
  { value: null, label: "Süresiz" },
];

const STATUS_STYLE: Record<KeyStatus, string> = {
  active: "bg-cyan/15 text-cyan",
  unused: "bg-gold/15 text-gold",
  expired: "bg-live/15 text-live",
  exhausted: "bg-live/15 text-live",
  disabled: "bg-ink-3 text-muted",
};

type Filter = "all" | KeyStatus;

function copy(text: string) {
  return navigator.clipboard?.writeText(text).catch(() => {});
}

function download(name: string, content: string, type = "text/plain") {
  const blob = new Blob(["﻿" + content], { type: `${type};charset=utf-8` });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function fmtDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" }) : "";
}

export default function KeysTab() {
  const { state, setState, api, toast, now } = useAdmin();
  const keys = state.keys;

  // Oluşturma formu
  const [count, setCount] = useState("1");
  const [label, setLabel] = useState("");
  const [maxUses, setMaxUses] = useState<number | null>(1);
  const [customUses, setCustomUses] = useState("");
  const [days, setDays] = useState<number | null>(30);
  const [customDays, setCustomDays] = useState("");
  const [startMode, setStartMode] = useState<MemberKey["startMode"]>("first-use");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<MemberKey[]>([]);

  // Liste
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [limit, setLimit] = useState(50);
  const [pending, setPending] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const usesValue = customUses ? Number(customUses) : maxUses;
  const daysValue = customDays ? Number(customDays) : days;

  function apply(r: KeysResp | null) {
    if (!r) return false;
    setState((s) => ({ ...s, keys: r.keys }));
    return true;
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await api<KeysResp>(
      "/api/admin/keys",
      {
        method: "POST",
        body: JSON.stringify({ count: Number(count) || 1, label, maxUses: usesValue, durationDays: daysValue, startMode }),
      },
      Number(count) > 1 ? `${count} anahtar oluşturuldu` : "Anahtar oluşturuldu"
    );
    if (apply(r) && r?.created) {
      setCreated(r.created);
      if (r.created.length === 1) {
        copy(r.created[0].code);
        toast("Anahtar panoya kopyalandı");
      }
    }
    setBusy(false);
  }

  async function act(k: MemberKey, body: object, ok: string) {
    setPending(k.code);
    apply(await api<KeysResp>(`/api/admin/keys/${encodeURIComponent(k.code)}`, { method: "PATCH", body: JSON.stringify(body) }, ok));
    setPending(null);
  }

  async function remove(k: MemberKey) {
    if (!confirm(`${k.code} silinsin mi? Bu anahtarla giriş yapmış üyelerin oturumu kapanır.`)) return;
    setPending(k.code);
    apply(await api<KeysResp>(`/api/admin/keys/${encodeURIComponent(k.code)}`, { method: "DELETE" }, "Anahtar silindi"));
    setPending(null);
  }

  function editLabel(k: MemberKey) {
    const v = prompt("Etiket (kime verildiği, not vb.)", k.label);
    if (v === null) return;
    act(k, { action: "edit", label: v }, "Etiket güncellendi");
  }

  function doCopy(code: string) {
    copy(code);
    setCopied(code);
    setTimeout(() => setCopied((c) => (c === code ? null : c)), 1500);
  }

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: keys.length, active: 0, unused: 0, expired: 0, exhausted: 0, disabled: 0 };
    for (const k of keys) c[keyStatus(k, now)]++;
    return c;
    // dakikada bir yeterli
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys, Math.floor(now / 60000)]);

  const list = useMemo(() => {
    const qq = q.trim().toUpperCase();
    return keys.filter((k) => {
      if (filter !== "all" && keyStatus(k, now) !== filter) return false;
      if (!qq) return true;
      return k.code.includes(qq) || k.code.replace(/-/g, "").includes(qq.replace(/-/g, "")) || k.label.toUpperCase().includes(qq);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys, q, filter, Math.floor(now / 60000)]);

  function exportCsv() {
    const rows = [["Anahtar", "Etiket", "Durum", "Giriş", "Giriş hakkı", "Süre", "Bitiş", "İlk giriş", "Son giriş", "Oluşturulma"]];
    for (const k of list) {
      rows.push([
        k.code,
        k.label,
        STATUS_LABEL[keyStatus(k, now)],
        String(k.uses),
        k.maxUses === null ? "Sınırsız" : String(k.maxUses),
        durationLabel(k.durationDays),
        fmtDate(k.expiresAt),
        fmtDate(k.activatedAt),
        fmtDate(k.lastUsedAt),
        fmtDate(k.createdAt),
      ]);
    }
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(";")).join("\n");
    download(`anahtarlar-${new Date().toISOString().slice(0, 10)}.csv`, csv, "text/csv");
  }

  const filters: { value: Filter; label: string }[] = [
    { value: "all", label: `Tümü ${counts.all}` },
    { value: "active", label: `Aktif ${counts.active}` },
    { value: "unused", label: `Kullanılmadı ${counts.unused}` },
    { value: "expired", label: `Süresi doldu ${counts.expired}` },
    { value: "exhausted", label: `Hakkı doldu ${counts.exhausted}` },
    { value: "disabled", label: `Devre dışı ${counts.disabled}` },
  ];

  return (
    <div>
      <PageHead
        title="Anahtarlar"
        desc="Üyelerin siteye girmek için kullandığı anahtarları oluştur. Her anahtarın giriş hakkı ve üyelik süresi ayrı ayarlanır."
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)]">
        <div className="space-y-6">
          <Panel title="Anahtar oluştur" icon={Sparkles} className="xl:sticky xl:top-6">
            <form onSubmit={create} className="space-y-5">
              <div className="grid grid-cols-[110px_1fr] gap-3">
                <label className="block">
                  <span className="mb-1.5 block text-[14px] font-semibold">Adet</span>
                  <input type="number" min={1} max={200} value={count} onChange={(e) => setCount(e.target.value)} className={`${field} tabular-nums`} />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[14px] font-semibold">Etiket</span>
                  <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} placeholder="Örn. Ahmet, Kasım satışı" className={field} />
                </label>
              </div>

              <fieldset>
                <legend className="mb-1.5 text-[14px] font-semibold">Giriş hakkı</legend>
                <p className="mb-2 text-[13px] text-muted">Anahtarla kaç kez giriş yapılabileceği. Her yeni cihaz ya da tarayıcı bir hak kullanır.</p>
                <Chips options={USE_OPTIONS} value={customUses ? -1 : maxUses} onChange={(v) => { setMaxUses(v); setCustomUses(""); }} />
                <input
                  type="number"
                  min={1}
                  value={customUses}
                  onChange={(e) => setCustomUses(e.target.value)}
                  placeholder="Başka bir sayı"
                  className={`${field} mt-2 w-40 tabular-nums`}
                />
              </fieldset>

              <fieldset>
                <legend className="mb-1.5 text-[14px] font-semibold">Üyelik süresi</legend>
                <Chips options={DAY_OPTIONS} value={customDays ? -1 : days} onChange={(v) => { setDays(v); setCustomDays(""); }} />
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    value={customDays}
                    onChange={(e) => setCustomDays(e.target.value)}
                    placeholder="Gün sayısı"
                    className={`${field} w-40 tabular-nums`}
                  />
                  <span className="text-[13px] text-muted">gün</span>
                </div>
              </fieldset>

              {daysValue !== null && (
                <fieldset>
                  <legend className="mb-1.5 text-[14px] font-semibold">Süre ne zaman başlasın</legend>
                  <Chips
                    options={[
                      { value: "first-use" as const, label: "İlk girişte" },
                      { value: "created" as const, label: "Hemen" },
                    ]}
                    value={startMode}
                    onChange={setStartMode}
                  />
                </fieldset>
              )}

              <div className="rounded-xl border border-line bg-ink px-4 py-3 text-[14px] text-muted">
                <Ticket className="mr-2 inline size-4 text-gold" aria-hidden="true" />
                {Number(count) > 1 ? `${count} anahtar` : "1 anahtar"},{" "}
                {usesValue === null ? "sınırsız giriş" : `${usesValue} giriş hakkı`},{" "}
                {daysValue === null ? "süresiz" : `${durationLabel(daysValue)} üyelik`}
                {daysValue !== null && (startMode === "first-use" ? " (ilk girişte başlar)" : " (şimdi başlar)")}
              </div>

              <button
                disabled={busy}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gold px-5 py-3.5 font-display text-[16px] font-bold text-ink transition-colors hover:bg-gold-soft disabled:opacity-50"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                Anahtar oluştur
              </button>
            </form>

            <AnimatePresence>
              {created.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-5 rounded-xl border border-gold/40 bg-gold/[0.07] p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <p className="flex items-center gap-2 font-semibold text-gold">
                        <CircleCheck className="size-4" aria-hidden="true" />
                        {created.length} yeni anahtar
                      </p>
                      <button onClick={() => setCreated([])} className="text-muted hover:text-text" aria-label="Kapat">
                        <X className="size-4" />
                      </button>
                    </div>
                    <ul className="max-h-64 space-y-1 overflow-y-auto">
                      {created.map((k) => (
                        <li key={k.code} className="flex items-center justify-between gap-2 rounded-lg bg-ink px-3 py-2">
                          <code className="font-display text-[15px] font-bold tracking-[0.06em]">{k.code}</code>
                          <IconBtn label="Kopyala" icon={copied === k.code ? Check : Copy} onClick={() => doCopy(k.code)} />
                        </li>
                      ))}
                    </ul>
                    {created.length > 1 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          onClick={() => {
                            copy(created.map((k) => k.code).join("\n"));
                            toast("Tüm anahtarlar kopyalandı");
                          }}
                          className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-[14px] font-semibold hover:border-gold"
                        >
                          <Copy className="size-4" aria-hidden="true" />
                          Tümünü kopyala
                        </button>
                        <button
                          onClick={() => download(`anahtarlar-${Date.now()}.txt`, created.map((k) => k.code).join("\n"))}
                          className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-[14px] font-semibold hover:border-gold"
                        >
                          <Download className="size-4" aria-hidden="true" />
                          TXT indir
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Panel>
        </div>

        <div>
          <div className="mb-3 flex flex-wrap gap-2">
            <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-line bg-ink-2 px-3 focus-within:border-gold">
              <Search className="size-4 shrink-0 text-muted" aria-hidden="true" />
              <span className="sr-only">Anahtar ara</span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Anahtar veya etiket ara"
                className="min-w-0 flex-1 bg-transparent py-2.5 text-[15px] outline-none placeholder:text-muted/70"
              />
            </label>
            <button
              onClick={exportCsv}
              disabled={!list.length}
              className="inline-flex items-center gap-2 rounded-xl border border-line px-3.5 py-2.5 text-[14px] font-semibold text-muted hover:text-text disabled:opacity-40"
            >
              <Download className="size-4" aria-hidden="true" />
              CSV indir
            </button>
          </div>
          <div className="mb-4">
            <div className="flex flex-wrap gap-2">
              {filters.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  className={`rounded-full border px-3 py-1.5 text-[13px] font-semibold whitespace-nowrap tabular-nums transition-colors ${
                    filter === f.value ? "border-text bg-text text-ink" : "border-line text-muted hover:text-text"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {list.length ? (
            <ul className="divide-y divide-line rounded-2xl border border-line bg-ink-2">
              {list.slice(0, limit).map((k) => {
                const st = keyStatus(k, now);
                const left = k.expiresAt ? new Date(k.expiresAt).getTime() - now : null;
                const timeText =
                  k.durationDays === null && !k.expiresAt
                    ? "Süresiz"
                    : left === null
                      ? `${durationLabel(k.durationDays)}, ilk girişte başlar`
                      : left > 0
                        ? `${formatDuration(left)} kaldı`
                        : `${formatAgo(-left)} doldu`;
                return (
                  <li key={k.code} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => doCopy(k.code)}
                          className="group inline-flex items-center gap-1.5 font-display text-[15px] font-bold tracking-[0.05em] hover:text-gold"
                          title="Kopyala"
                        >
                          {k.code}
                          {copied === k.code ? (
                            <Check className="size-3.5 text-cyan" aria-hidden="true" />
                          ) : (
                            <Copy className="size-3.5 opacity-0 transition-opacity group-hover:opacity-60" aria-hidden="true" />
                          )}
                        </button>
                        <span className={`rounded-full px-2 py-0.5 text-[12px] font-bold ${STATUS_STYLE[st]}`}>{STATUS_LABEL[st]}</span>
                      </div>
                      {k.label && <div className="mt-0.5 truncate text-[14px] text-text/80">{k.label}</div>}
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[13px] text-muted tabular-nums">
                        <span>{timeText}</span>
                        <span>
                          Giriş {k.uses} / {k.maxUses === null ? "sınırsız" : k.maxUses}
                        </span>
                        {k.lastUsedAt && <span>Son giriş {formatAgo(now - new Date(k.lastUsedAt).getTime())}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5">
                      {pending === k.code ? (
                        <Loader2 className="m-2 size-4 animate-spin text-muted" />
                      ) : (
                        <>
                          <IconBtn label="Düzenle" icon={Pencil} onClick={() => editLabel(k)} />
                          <IconBtn
                            label={k.disabled ? "Etkinleştir" : "Devre dışı bırak"}
                            icon={k.disabled ? CircleCheck : Ban}
                            danger={!k.disabled}
                            onClick={() => act(k, { action: k.disabled ? "enable" : "disable" }, k.disabled ? "Anahtar etkinleştirildi" : "Anahtar devre dışı bırakıldı")}
                          />
                          <Menu
                            items={[
                              { label: "1 gün uzat", icon: CalendarPlus, onClick: () => act(k, { action: "extend", days: 1 }, "1 gün uzatıldı"), hidden: k.durationDays === null && !k.expiresAt },
                              { label: "7 gün uzat", icon: CalendarPlus, onClick: () => act(k, { action: "extend", days: 7 }, "7 gün uzatıldı"), hidden: k.durationDays === null && !k.expiresAt },
                              { label: "30 gün uzat", icon: CalendarPlus, onClick: () => act(k, { action: "extend", days: 30 }, "30 gün uzatıldı"), hidden: k.durationDays === null && !k.expiresAt },
                              { label: "1 giriş hakkı ekle", icon: Plus, onClick: () => act(k, { action: "addUses", count: 1 }, "1 giriş hakkı eklendi"), hidden: k.maxUses === null },
                              { label: "5 giriş hakkı ekle", icon: Plus, onClick: () => act(k, { action: "addUses", count: 5 }, "5 giriş hakkı eklendi"), hidden: k.maxUses === null },
                              { label: "Girişleri sıfırla", icon: RotateCcw, onClick: () => act(k, { action: "resetUses" }, "Giriş sayısı sıfırlandı") },
                              { label: "Açık oturumları kapat", icon: LogOut, onClick: () => act(k, { action: "revoke" }, "Oturumlar kapatıldı") },
                              { label: "Sil", icon: Trash2, danger: true, onClick: () => remove(k) },
                            ]}
                          />
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="flex flex-col items-center rounded-2xl border border-dashed border-line px-6 py-14 text-center">
              <KeyRound className="size-8 text-muted" aria-hidden="true" />
              <p className="mt-4 font-display text-lg font-bold">{keys.length ? "Bu filtrede anahtar yok" : "Henüz anahtar yok"}</p>
              <p className="mt-1 max-w-sm text-[15px] text-muted">
                {keys.length ? "Başka bir filtre seç ya da aramayı temizle." : "Soldaki formdan ilk anahtarı oluştur, üyene gönder."}
              </p>
            </div>
          )}
          {list.length > limit && (
            <button
              onClick={() => setLimit((l) => l + 50)}
              className="mt-3 w-full rounded-xl border border-line py-3 text-[14px] font-semibold text-muted hover:text-text"
            >
              {list.length - limit} anahtar daha göster
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
