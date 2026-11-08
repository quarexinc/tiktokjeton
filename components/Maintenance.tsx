import { Wrench } from "lucide-react";
import { SpinningCoin } from "./Coin";

export default function Maintenance({ text }: { text: string }) {
  return (
    <main className="hero-glow grid min-h-dvh place-items-center px-4 text-center">
      <div className="max-w-md">
        <div className="mx-auto mb-8 w-fit">
          <SpinningCoin size={110} />
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-line bg-ink-2 px-4 py-2 text-[14px] text-muted">
          <Wrench className="size-4 text-gold" aria-hidden="true" />
          Bakım çalışması
        </span>
        <h1 className="mt-5 font-display text-4xl font-extrabold tracking-tight">Birazdan buradayız</h1>
        <p className="mt-3 text-[17px] leading-relaxed text-muted">{text}</p>
      </div>
    </main>
  );
}
