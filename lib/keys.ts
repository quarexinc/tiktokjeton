import type { KeyStatus, MemberKey } from "./types";

// Karışabilecek karakterler (0/O, 1/I/L) yok
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Depolamada alan adı: büyük harf, sadece harf/rakam */
export function codeField(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Kullanıcının yazdığını TJ-XXXX-XXXX-XXXX biçimine getirir */
export function formatCode(input: string): string {
  const raw = codeField(input);
  const body = raw.startsWith("TJ") ? raw.slice(2) : raw;
  const groups = body.match(/.{1,4}/g) ?? [];
  return ["TJ", ...groups].join("-");
}

export function generateCode(): string {
  const bytes = new Uint8Array(12);
  globalThis.crypto.getRandomValues(bytes);
  let s = "";
  for (const b of bytes) s += ALPHABET[b % ALPHABET.length];
  return `TJ-${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`;
}

export function keyExpired(k: MemberKey, now: number): boolean {
  return k.expiresAt !== null && new Date(k.expiresAt).getTime() <= now;
}

export function usesLeft(k: MemberKey): number | null {
  return k.maxUses === null ? null : Math.max(0, k.maxUses - k.uses);
}

export function keyStatus(k: MemberKey, now: number): KeyStatus {
  if (k.disabled) return "disabled";
  if (keyExpired(k, now)) return "expired";
  if (k.maxUses !== null && k.uses >= k.maxUses) return "exhausted";
  if (!k.activatedAt) return "unused";
  return "active";
}

export const STATUS_LABEL: Record<KeyStatus, string> = {
  unused: "Kullanılmadı",
  active: "Aktif",
  expired: "Süresi doldu",
  disabled: "Devre dışı",
  exhausted: "Hakkı doldu",
};

/** Yeni girişe izin var mı? Hata mesajı ya da null döner. */
export function loginBlockReason(k: MemberKey, now: number): string | null {
  if (k.disabled) return "Bu anahtar devre dışı bırakılmış.";
  if (keyExpired(k, now)) return "Bu anahtarın süresi dolmuş.";
  if (k.maxUses !== null && k.uses >= k.maxUses) return "Bu anahtarın giriş hakkı dolmuş.";
  return null;
}

/** Açık bir oturum hâlâ geçerli mi? (Giriş hakkı dolmuş olsa da açık oturum devam eder.) */
export function sessionValid(k: MemberKey, now: number): boolean {
  return !k.disabled && !keyExpired(k, now);
}

export function durationLabel(days: number | null): string {
  if (days === null) return "Süresiz";
  if (days % 365 === 0) return `${days / 365} yıl`;
  if (days % 30 === 0) return `${days / 30} ay`;
  if (days % 7 === 0) return `${days / 7} hafta`;
  return `${days} gün`;
}
