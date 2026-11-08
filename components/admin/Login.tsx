"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, KeyRound, Loader2, TriangleAlert } from "lucide-react";
import { SpinningCoin } from "../Coin";

export default function Login({ configured }: { configured: boolean }) {
  const [key, setKey] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!key) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      if (r.ok) {
        window.location.reload();
        return;
      }
      const j = await r.json().catch(() => ({}));
      setError(j.error ?? "Giriş yapılamadı.");
    } catch {
      setError("Sunucuya ulaşılamadı. Bağlantını kontrol et.");
    }
    setBusy(false);
  }

  return (
    <main className="hero-glow grid min-h-dvh place-items-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 22 }}
        className="w-full max-w-sm"
      >
        <div className="mb-8 flex justify-center">
          <SpinningCoin size={96} />
        </div>
        <h1 className="text-center font-display text-3xl font-extrabold tracking-tight">Yönetim paneli</h1>
        <p className="mt-2 text-center text-[15px] text-muted">Devam etmek için admin anahtarını gir.</p>

        {!configured && (
          <div className="mt-6 flex gap-3 rounded-xl border border-live/40 bg-live/10 p-4 text-[14px] text-text">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-live" aria-hidden="true" />
            <p>
              Sunucuda <code className="rounded bg-ink-3 px-1">ADMIN_KEY</code> tanımlı değil. Vercel proje ayarlarındaki
              ortam değişkenlerine ekle ve yeniden yayınla.
            </p>
          </div>
        )}

        <form onSubmit={submit} className="mt-6 space-y-3">
          <label className="block">
            <span className="sr-only">Admin anahtarı</span>
            <div className="flex items-center gap-2 rounded-xl border border-line bg-ink-2 px-3 focus-within:border-gold">
              <KeyRound className="size-4 text-muted" aria-hidden="true" />
              <input
                type={show ? "text" : "password"}
                value={key}
                onChange={(e) => setKey(e.target.value)}
                autoComplete="current-password"
                autoFocus
                placeholder="Anahtar"
                className="min-w-0 flex-1 bg-transparent py-3.5 text-[16px] outline-none placeholder:text-muted/70"
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                className="grid size-8 place-items-center rounded-lg text-muted hover:text-text"
                aria-label={show ? "Anahtarı gizle" : "Anahtarı göster"}
              >
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </label>

          {error && (
            <motion.p initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className="text-[14px] text-live" role="alert">
              {error}
            </motion.p>
          )}

          <button
            disabled={busy || !key || !configured}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gold py-3.5 font-display text-[17px] font-bold text-ink transition-colors hover:bg-gold-soft disabled:opacity-50"
          >
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            Giriş yap
          </button>
        </form>

        <p className="mt-8 text-center text-[14px]">
          <a href="/" className="text-muted hover:text-text">
            Ana sayfaya dön
          </a>
        </p>
      </motion.div>
    </main>
  );
}
