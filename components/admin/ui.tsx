"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MoreHorizontal, type LucideIcon } from "lucide-react";

export const field =
  "w-full rounded-xl border border-line bg-ink px-3.5 py-3 text-[15px] outline-none transition-colors placeholder:text-muted/60 focus:border-gold";

export function Panel({
  title,
  icon: Icon,
  action,
  children,
  className = "",
}: {
  title: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-line bg-ink-2 p-4 sm:p-5 ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold">
          {Icon && <Icon className="size-4 text-gold" aria-hidden="true" />}
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Stat({
  icon: Icon,
  label,
  value,
  hint,
  tone = "text-muted",
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-ink-2 px-4 py-3.5">
      <div className={`flex items-center gap-1.5 text-[13px] ${tone}`}>
        <Icon className="size-3.5" aria-hidden="true" />
        {label}
      </div>
      <div className="mt-1 font-display text-3xl font-extrabold tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 text-[12px] text-muted">{hint}</div>}
    </div>
  );
}

export function IconBtn({
  label,
  icon: Icon,
  onClick,
  danger,
  active,
}: {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  danger?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`grid size-9 place-items-center rounded-lg border border-transparent transition-colors hover:border-line ${
        active ? "text-gold" : "text-muted"
      } ${danger ? "hover:text-live" : "hover:text-text"}`}
    >
      <Icon className={`size-4 ${active ? "fill-current" : ""}`} aria-hidden="true" />
    </button>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${on ? "bg-gold" : "bg-ink-3"}`}
    >
      <motion.span
        className="absolute top-1 left-1 size-5 rounded-full bg-text"
        animate={{ x: on ? 20 : 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 32 }}
      />
    </button>
  );
}

export function Chips<T extends string | number | null>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          type="button"
          key={String(o.value)}
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`rounded-lg border px-3 py-2 text-[14px] font-semibold tabular-nums transition-colors ${
            value === o.value ? "border-gold bg-gold text-ink" : "border-line text-muted hover:text-text"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export type MenuItem = { label: string; icon: LucideIcon; onClick: () => void; danger?: boolean; hidden?: boolean };

export function Menu({ items, label = "Diğer işlemler" }: { items: MenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <IconBtn label={label} icon={MoreHorizontal} onClick={() => setOpen((v) => !v)} />
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 z-30 mt-1 w-56 origin-top-right overflow-hidden rounded-xl border border-line bg-ink-3 p-1 shadow-2xl"
          >
            {items
              .filter((i) => !i.hidden)
              .map((i) => (
                <button
                  key={i.label}
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    i.onClick();
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[14px] transition-colors hover:bg-ink-2 ${
                    i.danger ? "text-live" : "text-text"
                  }`}
                >
                  <i.icon className="size-4 shrink-0 opacity-80" aria-hidden="true" />
                  {i.label}
                </button>
              ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Bars({ data, tone = "bg-gold" }: { data: { day: string; count: number }[]; tone?: string }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="flex h-28 items-end gap-1.5">
      {data.map((d, i) => {
        const date = new Date(d.day + "T12:00:00");
        const label = date.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
        return (
          <div key={d.day} className="group relative flex h-full flex-1 flex-col justify-end" title={`${label}: ${d.count}`}>
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: `${Math.max(d.count ? 6 : 2, (d.count / max) * 100)}%` }}
              transition={{ delay: i * 0.02, type: "spring", stiffness: 180, damping: 22 }}
              className={`w-full rounded-md ${d.count ? tone : "bg-line"} opacity-80 group-hover:opacity-100`}
            />
            <span className="pointer-events-none absolute -top-6 left-1/2 hidden -translate-x-1/2 rounded bg-ink px-1.5 py-0.5 text-[11px] whitespace-nowrap text-text tabular-nums group-hover:block">
              {d.count}
            </span>
          </div>
        );
      })}
    </div>
  );
}
