export type Stream = {
  id: string;
  username: string;
  title: string;
  url: string;
  coins: number | null;
  note: string;
  /** ISO tarih: yayının ana sayfada görünmeye başlayacağı an */
  startsAt: string;
  /** Ana sayfada "aktif" olarak kalma süresi (dakika) */
  durationMin: number;
  /** Admin elle bitirdiyse ISO tarih */
  endedAt: string | null;
  /** Listenin en üstünde vurgulu gösterilir */
  featured?: boolean;
  /** Kim ekledi: admin elle mi, bot mu */
  source?: "manual" | "bot";
  /** Bot ekledi ve admin onayı bekliyor; ana sayfada görünmez */
  pending?: boolean;
  /** Yayında şu an açılmayı bekleyen sandık sayısı (bot doldurur) */
  chests?: number | null;
  /** Bir sonraki sandığın açılacağı an (ISO) */
  nextChestAt?: string | null;
  viewers?: number | null;
  /** Botun bu yayın için son bilgi gönderdiği an */
  botSeenAt?: string | null;
  createdAt: string;
};

/** Otomatik tarama botunun ayarları ve durumu */
export type BotConfig = {
  /** API anahtarının sha256 özeti; anahtarın kendisi saklanmaz */
  tokenHash: string | null;
  tokenHint: string | null;
  tokenCreatedAt: string | null;
  /** Bot yayınları onaysız doğrudan ana sayfaya düşsün mü */
  autoPublish: boolean;
  /** Bot yayını ana sayfada en az bu kadar kalır; her raporda yenilenir (dk) */
  defaultDurationMin: number;
  /** Bu miktarın altındaki sandıklı yayınlar eklenmez */
  minCoins: number;
  /** Botun takip edeceği TikTok kullanıcı adları */
  watchlist: string[];
  lastSeenAt: string | null;
  lastStatus: {
    watching: number;
    live: number;
    connected: number;
    version: string;
    host: string;
    /** Keşif modu (bot 2.x) */
    discovery?: boolean;
    pool?: number;
    probing?: number;
    holding?: number;
    chestAccounts?: number;
    discoveredToday?: number;
  } | null;
};

export const DEFAULT_BOT: BotConfig = {
  tokenHash: null,
  tokenHint: null,
  tokenCreatedAt: null,
  autoPublish: true,
  defaultDurationMin: 20,
  minCoins: 0,
  watchlist: [],
  lastSeenAt: null,
  lastStatus: null,
};

export type Settings = {
  announcement: string;
  showPast: boolean;
  pastLimit: number;
  /** Ana sayfaya girmek için üyelik anahtarı istenir */
  requireKey: boolean;
  /** Anahtar almak için gidilecek link (Telegram, Instagram, WhatsApp vb.) */
  contactUrl: string;
  contactLabel: string;
  maintenance: boolean;
  maintenanceText: string;
};

export type DB = {
  streams: Stream[];
  settings: Settings;
};

export type StreamStatus = "live" | "upcoming" | "past";

export const DEFAULT_SETTINGS: Settings = {
  announcement: "",
  showPast: true,
  pastLimit: 24,
  requireKey: true,
  contactUrl: "",
  contactLabel: "Anahtar al",
  maintenance: false,
  maintenanceText: "Site kısa bir bakımda. Birazdan tekrar dene.",
};

/** Üyelik anahtarı */
export type MemberKey = {
  /** Görünen biçim: TJ-ABCD-EFGH-JKLM */
  code: string;
  label: string;
  /** Kaç kez giriş yapılabilir. null = sınırsız */
  maxUses: number | null;
  uses: number;
  /** Üyelik süresi (gün). null = süresiz */
  durationDays: number | null;
  /** Süre ilk girişte mi yoksa oluşturulunca mı başlar */
  startMode: "first-use" | "created";
  expiresAt: string | null;
  activatedAt: string | null;
  lastUsedAt: string | null;
  disabled: boolean;
  /** Artırılınca bu anahtarla açılmış tüm oturumlar kapanır */
  sessionVersion: number;
  createdAt: string;
};

export type KeyStatus = "unused" | "active" | "expired" | "disabled" | "exhausted";

export type LogEntry = {
  t: string;
  type:
    | "member_login"
    | "member_fail"
    | "admin_login"
    | "admin_fail"
    | "key_created"
    | "key_updated"
    | "key_deleted"
    | "stream_added"
    | "stream_updated"
    | "stream_deleted"
    | "settings"
    | "bot";
  msg: string;
};

export type Overview = {
  clicks: Record<string, number>;
  log: LogEntry[];
  /** Son 14 günün günlük üye giriş sayıları, eskiden yeniye */
  loginsByDay: { day: string; count: number }[];
  clicksByDay: { day: string; count: number }[];
  storage: "neon" | "redis" | "blob" | "local" | "none";
};
