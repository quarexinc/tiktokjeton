"use client";

import { useState } from "react";
import { Loader2, Plus, Save, X } from "lucide-react";
import type { Stream } from "@/lib/types";

const PRESETS = [
  { min: 15, label: "15 dk" },
  { min: 30, label: "30 dk" },
  { min: 60, label: "1 sa" },
  { min: 120, label: "2 sa" },
  { min: 180, label: "3 sa" },
  { min: 360, label: "6 sa" },
  { min: 720, label: "12 sa" },
  { min: 1440, label: "1 gün" },
];

type Unit = "dk" | "sa" | "gün";
const UNIT_MIN: Record<Unit, number> = { dk: 1, sa: 60, "gün": 1440 };

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function splitDuration(min: number): { amount: number; unit: Unit } {
  if (min % 1440 === 0) return { amount: min / 1440, unit: "gün" };
  if (min % 60 === 0) return { amount: min / 60, unit: "sa" };
  return { amount: min, unit: "dk" };
}

export type StreamPayload = {
  username: string;
  url: string;
  title: string;
  coins: string;
  note: string;
  startsAt: string | null;
  durationMin: number;
};

const field =
  "w-full rounded-xl border border-line bg-ink px-3.5 py-3 text-[15px] outline-none transition-colors placeholder:text-muted/60 focus:border-gold";

export default function StreamForm({
  editing,
  onSubmit,
  onCancel,
}: {
  editing: Stream | null;
  onSubmit: (p: StreamPayload) => Promise<boolean>;
  onCancel?: () => void;
}) {
  const init = editing ? splitDuration(editing.durationMin) : { amount: 1, unit: "sa" as Unit };
  const [username, setUsername] = useState(editing?.username ?? "");
  const [url, setUrl] = useState(editing?.url ?? "");
  const [title, setTitle] = useState(editing?.title ?? "");
  const [coins, setCoins] = useState(editing?.coins != null ? String(editing.coins) : "");
  const [note, setNote] = useState(editing?.note ?? "");
  const [startMode, setStartMode] = useState<"now" | "later">(editing ? "later" : "now");
  const [startsAt, setStartsAt] = useState(editing ? toLocalInput(editing.startsAt) : "");
  const [amount, setAmount] = useState(String(init.amount));
  const [unit, setUnit] = useState<Unit>(init.unit);
  const [busy, setBusy] = useState(false);

  const durationMin = Math.round(Number(amount) * UNIT_MIN[unit]);
  const autoUrl = username.trim() ? `https://www.tiktok.com/@${username.trim().replace(/^@+/, "")}/live` : "";

  function pickPreset(min: number) {
    const d = splitDuration(min);
    setAmount(String(d.amount));
    setUnit(d.unit);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const ok = await onSubmit({
      username,
      url,
      title,
      coins,
      note,
      startsAt: startMode === "now" ? (editing ? new Date().toISOString() : null) : startsAt ? new Date(startsAt).toISOString() : null,
      durationMin,
    });
    setBusy(false);
    if (ok && !editing) {
      setUsername("");
      setUrl("");
      setTitle("");
      setCoins("");
      setNote("");
      setStartMode("now");
      setStartsAt("");
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-[14px] font-semibold">TikTok kullanıcı adı</span>
          <div className="flex items-center rounded-xl border border-line bg-ink focus-within:border-gold">
            <span className="pl-3.5 text-muted">@</span>
            <input
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="kullaniciadi"
              autoCapitalize="none"
              autoCorrect="off"
              className="min-w-0 flex-1 bg-transparent px-1.5 py-3 text-[15px] outline-none placeholder:text-muted/60"
            />
          </div>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[14px] font-semibold">Jeton miktarı</span>
          <input
            inputMode="numeric"
            value={coins}
            onChange={(e) => setCoins(e.target.value.replace(/[^\d]/g, ""))}
            placeholder="Örn. 5000 (boş bırakılabilir)"
            className={field}
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-[14px] font-semibold">Yayın linki</span>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={autoUrl || "https://www.tiktok.com/@kullaniciadi/live"}
          className={field}
        />
        <span className="mt-1 block text-[13px] text-muted">Boş bırakırsan kullanıcı adından canlı yayın linki oluşturulur.</span>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-[14px] font-semibold">Başlık</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Örn. Her 10 dakikada bir kutu" className={field} />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-[14px] font-semibold">Not</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={240}
          rows={2}
          placeholder="Kullanıcılara kısa bir açıklama (isteğe bağlı)"
          className={`${field} resize-y`}
        />
      </label>

      <fieldset>
        <legend className="mb-1.5 text-[14px] font-semibold">Başlangıç</legend>
        <div className="flex flex-wrap gap-2">
          {(["now", "later"] as const).map((m) => (
            <button
              type="button"
              key={m}
              onClick={() => setStartMode(m)}
              aria-pressed={startMode === m}
              className={`rounded-lg border px-3.5 py-2 text-[14px] font-semibold transition-colors ${
                startMode === m ? "border-gold bg-gold text-ink" : "border-line text-muted hover:text-text"
              }`}
            >
              {m === "now" ? (editing ? "Şimdiden başlat" : "Hemen") : editing ? "Tarihi koru veya değiştir" : "İleri tarih"}
            </button>
          ))}
        </div>
        {startMode === "later" && (
          <input
            type="datetime-local"
            required
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className={`${field} mt-2 sm:max-w-xs`}
          />
        )}
      </fieldset>

      <fieldset>
        <legend className="mb-1.5 text-[14px] font-semibold">Ana sayfada kalma süresi</legend>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              type="button"
              key={p.min}
              onClick={() => pickPreset(p.min)}
              aria-pressed={durationMin === p.min}
              className={`rounded-lg border px-3 py-2 text-[14px] font-semibold tabular-nums transition-colors ${
                durationMin === p.min ? "border-gold bg-gold text-ink" : "border-line text-muted hover:text-text"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <input
            type="number"
            min={1}
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={`${field} w-28 tabular-nums`}
            aria-label="Süre"
          />
          <select value={unit} onChange={(e) => setUnit(e.target.value as Unit)} className={`${field} w-28`} aria-label="Birim">
            <option value="dk">dakika</option>
            <option value="sa">saat</option>
            <option value="gün">gün</option>
          </select>
        </div>
        <span className="mt-1 block text-[13px] text-muted">Süre dolunca yayın Geçmiş&apos;e taşınır.</span>
      </fieldset>

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          disabled={busy || !username || !(durationMin >= 1)}
          className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-3 font-display text-[16px] font-bold text-ink transition-colors hover:bg-gold-soft disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : editing ? <Save className="size-4" /> : <Plus className="size-4" />}
          {editing ? "Değişiklikleri kaydet" : "Yayını ekle"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-3 font-semibold text-muted hover:text-text"
          >
            <X className="size-4" />
            Vazgeç
          </button>
        )}
      </div>
    </form>
  );
}
