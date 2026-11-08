"use client";

import { useState } from "react";
import { MotionConfig, motion } from "framer-motion";
import { BellRing, Coins, KeyRound, Loader2, MousePointerClick, ShoppingBag } from "lucide-react";
import { CoinMark, SpinningCoin } from "./Coin";

function formatInput(v: string): string {
  const raw = v.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const body = (raw.startsWith("TJ") ? raw.slice(2) : raw).slice(0, 12);
  const groups = body.match(/.{1,4}/g) ?? [];
  return raw.length === 0 ? "" : ["TJ", ...groups].join("-");
}

export default function Gate({ contactUrl, contactLabel }: { contactUrl: string; contactLabel: string }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/member/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (r.ok) {
        window.location.reload();
        return;
      }
      const j = await r.json().catch(() => ({}));
      setError(j.error ?? "Giriş yapılamadı.");
      setShake((n) => n + 1);
    } catch {
      setError("Sunucuya ulaşılamadı. Bağlantını kontrol et.");
    }
    setBusy(false);
  }

  const complete = code.replace(/-/g, "").length === 14;

  return (
    <MotionConfig reducedMotion="user">
      <div className="grain pointer-events-none fixed inset-0 z-0" aria-hidden="true" />
      <div className="hero-glow relative z-10 flex min-h-dvh flex-col">
        <header className="mx-auto flex w-full max-w-5xl items-center gap-2.5 px-4 py-5 font-display text-[17px] font-bold sm:px-6">
          <CoinMark size={30} />
          Tiktok Jetonlu Yayın Bulma
        </header>

        <main className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-10 px-4 pb-16 sm:px-6 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <motion.div
              initial={{ y: -280, opacity: 0, scale: 0.6 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 120, damping: 11, mass: 1.1 }}
              className="mb-8 w-fit"
            >
              <SpinningCoin size={104} />
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45, type: "spring", stiffness: 140, damping: 18 }}
              className="font-display text-[42px] leading-[0.95] font-extrabold tracking-[-0.03em] text-balance sm:text-[64px]"
            >
              Jetonlu yayınlar üyelere açık
            </motion.h1>
            <motion.ul
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.75 }}
              className="mt-8 space-y-3 text-[16px] text-muted"
            >
              <li className="flex items-center gap-3">
                <Coins className="size-5 shrink-0 text-gold" aria-hidden="true" />
                Jeton dağıtılan canlı yayınlar tek listede
              </li>
              <li className="flex items-center gap-3">
                <MousePointerClick className="size-5 shrink-0 text-gold" aria-hidden="true" />
                Tek dokunuşla TikTok&apos;ta yayına geç
              </li>
              <li className="flex items-center gap-3">
                <BellRing className="size-5 shrink-0 text-gold" aria-hidden="true" />
                Yeni yayın açılınca sesli bildirim
              </li>
            </motion.ul>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, type: "spring", stiffness: 160, damping: 20 }}
            className="rounded-3xl border border-line bg-ink-2/90 p-6 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.7)] backdrop-blur sm:p-8"
          >
            <h2 className="font-display text-2xl font-bold">Üyelik anahtarını gir</h2>
            <p className="mt-1.5 text-[15px] text-muted">Anahtar TJ ile başlar ve 12 karakterden oluşur.</p>

            <form onSubmit={submit} className="mt-6 space-y-3">
              <motion.label
                key={shake}
                animate={shake ? { x: [0, -10, 10, -6, 6, 0] } : undefined}
                transition={{ duration: 0.4 }}
                className={`flex items-center gap-3 rounded-2xl border bg-ink px-4 focus-within:border-gold ${error ? "border-live/60" : "border-line"}`}
              >
                <KeyRound className="size-5 shrink-0 text-gold" aria-hidden="true" />
                <span className="sr-only">Üyelik anahtarı</span>
                <input
                  value={code}
                  onChange={(e) => setCode(formatInput(e.target.value))}
                  placeholder="TJ-XXXX-XXXX-XXXX"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  autoFocus
                  className="min-w-0 flex-1 bg-transparent py-4 font-display text-[20px] font-bold tracking-[0.08em] tabular-nums outline-none placeholder:font-normal placeholder:tracking-[0.06em] placeholder:text-muted/50"
                />
              </motion.label>

              {error && (
                <p className="text-[14px] text-live" role="alert">
                  {error}
                </p>
              )}

              <button
                disabled={busy || !complete}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gold py-4 font-display text-[18px] font-bold text-ink transition-colors hover:bg-gold-soft disabled:opacity-40"
              >
                {busy && <Loader2 className="size-5 animate-spin" aria-hidden="true" />}
                Giriş yap
              </button>
            </form>

            {contactUrl && (
              <div className="mt-6 border-t border-line pt-5">
                <p className="text-[14px] text-muted">Anahtarın yok mu?</p>
                <a
                  href={contactUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-line py-3.5 font-semibold transition-colors hover:border-gold hover:text-gold"
                >
                  <ShoppingBag className="size-4" aria-hidden="true" />
                  {contactLabel || "Anahtar al"}
                </a>
              </div>
            )}
          </motion.div>
        </main>
      </div>
    </MotionConfig>
  );
}
