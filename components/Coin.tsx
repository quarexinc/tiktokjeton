import type { CSSProperties } from "react";

/** Kendi tasarımımız olan jeton yüzü (SVG). */
export function CoinFace({ id = "c" }: { id?: string }) {
  const notches = Array.from({ length: 36 }, (_, i) => i * 10);
  return (
    <svg viewBox="0 0 200 200" className="h-full w-full" aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-g`} cx="35%" cy="30%" r="80%">
          <stop offset="0" stopColor="#fff2b8" />
          <stop offset="0.35" stopColor="#f7c948" />
          <stop offset="0.8" stopColor="#c8901a" />
          <stop offset="1" stopColor="#8a5c0a" />
        </radialGradient>
        <linearGradient id={`${id}-i`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffe08a" />
          <stop offset="1" stopColor="#d79a1c" />
        </linearGradient>
      </defs>
      <circle cx="100" cy="100" r="98" fill={`url(#${id}-g)`} />
      {notches.map((deg) => (
        <rect
          key={deg}
          x="98.5"
          y="4"
          width="3"
          height="9"
          rx="1.5"
          fill="#8a5c0a"
          opacity="0.55"
          transform={`rotate(${deg} 100 100)`}
        />
      ))}
      <circle cx="100" cy="100" r="78" fill={`url(#${id}-i)`} stroke="#9a680d" strokeWidth="3" />
      <circle cx="100" cy="100" r="68" fill="none" stroke="#fff3c4" strokeOpacity="0.55" strokeWidth="2" strokeDasharray="2 6" />
      {/* Oynat üçgeni + kıvılcım: canlı yayın jetonu */}
      <path d="M86 70 L134 100 L86 130 Z" fill="#7a4c06" stroke="#7a4c06" strokeWidth="8" strokeLinejoin="round" />
      <path d="M86 70 L134 100 L86 130 Z" fill="#fff0b0" opacity="0.35" transform="translate(-2 -2)" />
      <path d="M58 64 l4 10 l10 4 l-10 4 l-4 10 l-4 -10 l-10 -4 l10 -4 Z" fill="#fff6d6" />
      <ellipse cx="72" cy="52" rx="30" ry="12" fill="#ffffff" opacity="0.18" transform="rotate(-28 72 52)" />
    </svg>
  );
}

export function SpinningCoin({
  size = 160,
  still = false,
  className = "",
}: {
  size?: number;
  still?: boolean;
  className?: string;
}) {
  const depth = Math.max(6, Math.round(size * 0.08));
  const layers = Array.from({ length: depth }, (_, i) => i - depth / 2);
  const style = { "--coin-size": `${size}px`, "--coin-depth": `${depth}px` } as CSSProperties;
  return (
    <div className={`coin-stage ${className}`} style={style}>
      <div className={`coin ${still ? "is-still" : ""}`}>
        {layers.map((z) => (
          <div key={z} className="coin-edge" style={{ transform: `translateZ(${z}px)` }} />
        ))}
        <div className="coin-face front">
          <CoinFace id={`f${size}`} />
        </div>
        <div className="coin-face back">
          <CoinFace id={`b${size}`} />
        </div>
      </div>
    </div>
  );
}

/** Küçük, düz logo işareti */
export function CoinMark({ size = 28 }: { size?: number }) {
  return (
    <span className="inline-block shrink-0" style={{ width: size, height: size }}>
      <CoinFace id={`m${size}`} />
    </span>
  );
}
