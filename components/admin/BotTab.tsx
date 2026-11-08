"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  Bot,
  Check,
  Copy,
  KeyRound,
  ListPlus,
  Loader2,
  Plus,
  Radio,
  RefreshCw,
  Save,
  Search,
  Settings2,
  TerminalSquare,
  TriangleAlert,
  Users,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { PageHead, useAdmin } from "./AdminApp";
import { Panel, Stat, Toggle, field } from "./ui";
import { formatAgo } from "@/lib/status";
import type { BotAdminView } from "@/lib/bot";

const REPO_URL = "https://github.com/quarexinc/tiktokjeton/tree/main/bot";

function clean(raw: string): string[] {
  const out = new Set<string>();
  for (const part of raw.split(/[\s,;]+/)) {
    let u = part.trim();
    const m = u.match(/tiktok\.com\/@([A-Za-z0-9._]+)/);
    if (m) u = m[1];
    u = u.replace(/^@+/, "").toLowerCase();
    if (/^[a-z0-9._]{2,24}$/.test(u)) out.add(u);
  }
  return [...out];
}

function CopyBtn({ text, label = "Kopyala" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(text).catch(() => {});
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-[13px] font-semibold text-muted transition-colors hover:text-text"
    >
      {done ? <Check className="size-3.5 text-cyan" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
      {done ? "Kopyalandı" : label}
    </button>
  );
}

export default function BotTab() {
  const { state, setState, api, now } = useAdmin();
  const bot = state.bot;

  const [autoPublish, setAutoPublish] = useState(bot.autoPublish);
  const [duration, setDuration] = useState(String(bot.defaultDurationMin));
  const [minCoins, setMinCoins] = useState(String(bot.minCoins));
  const [list, setList] = useState<string[]>(bot.watchlist);
  const [add, setAdd] = useState("");
  const [bulk, setBulk] = useState(false);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [tokenBusy, setTokenBusy] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [origin, setOrigin] = useState("https://tiktokjeton.vercel.app");

  useEffect(() => {
    setOrigin(window.location.origin);
    // Bot durumunu canlı tut
    const t = setInterval(async () => {
      const r = await fetch("/api/admin/bot", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (r?.bot) setState((s) => ({ ...s, bot: { ...s.bot, lastSeenAt: r.bot.lastSeenAt, lastStatus: r.bot.lastStatus } }));
    }, 20_000);
    return () => clearInterval(t);
  }, [setState]);

  const dirty =
    autoPublish !== bot.autoPublish ||
    Number(duration) !== bot.defaultDurationMin ||
    Number(minCoins) !== bot.minCoins ||
    list.join(",") !== bot.watchlist.join(",");

  const online = bot.lastSeenAt !== null && now - new Date(bot.lastSeenAt).getTime() < 3 * 60_000;
  const st = bot.lastStatus;

  async function save() {
    setBusy(true);
    const r = await api<{ bot: BotAdminView }>(
      "/api/admin/bot",
      { method: "PUT", body: JSON.stringify({ autoPublish, defaultDurationMin: Number(duration), minCoins: Number(minCoins) || 0, watchlist: list }) },
      "Otomasyon ayarları kaydedildi"
    );
    if (r) {
      setState((s) => ({ ...s, bot: r.bot }));
      setList(r.bot.watchlist);
    }
    setBusy(false);
  }

  async function regenerate() {
    if (bot.hasToken && !confirm("Yeni anahtar oluşturulunca eski anahtar hemen çalışmaz. Botun config.json dosyasını güncellemen gerekir. Devam edilsin mi?")) return;
    setTokenBusy(true);
    const r = await api<{ token: string; bot: BotAdminView }>("/api/admin/bot/token", { method: "POST" }, "Yeni API anahtarı oluşturuldu");
    if (r) {
      setToken(r.token);
      setState((s) => ({ ...s, bot: r.bot }));
    }
    setTokenBusy(false);
  }

  function addNames(raw: string) {
    const names = clean(raw);
    if (!names.length) return;
    setList((l) => [...new Set([...names, ...l])]);
    setAdd("");
  }

  const shown = useMemo(() => {
    const qq = q.trim().toLowerCase().replace(/^@/, "");
    return qq ? list.filter((u) => u.includes(qq)) : list;
  }, [list, q]);

  const config = JSON.stringify(
    { site_url: origin, api_key: token ?? "BURAYA_API_ANAHTARI", extra_usernames: [], check_interval_sec: 120, max_connections: 25 },
    null,
    2
  );

  return (
    <div>
      <PageHead
        title="Otomasyon"
        desc="Python botu izleme listesindeki TikTok hesaplarını takip eder. Yayında sandık açılınca jeton miktarı ve linkiyle siteye kendisi ekler."
        action={
          <button
            onClick={save}
            disabled={busy || !dirty}
            className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-3 font-display font-bold text-ink transition-colors hover:bg-gold-soft disabled:opacity-40"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Kaydet
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <div className={`rounded-2xl border px-4 py-3.5 ${online ? "border-cyan/40 bg-cyan/[0.06]" : "border-line bg-ink-2"}`}>
          <div className={`flex items-center gap-1.5 text-[13px] ${online ? "text-cyan" : "text-muted"}`}>
            {online ? <Wifi className="size-3.5" aria-hidden="true" /> : <WifiOff className="size-3.5" aria-hidden="true" />}
            Bot durumu
          </div>
          <div className="mt-1 font-display text-2xl font-extrabold">{online ? "Çalışıyor" : "Kapalı"}</div>
          <div className="mt-0.5 text-[12px] text-muted">
            {bot.lastSeenAt ? `Son sinyal ${formatAgo(now - new Date(bot.lastSeenAt).getTime())}` : "Henüz bağlanmadı"}
            {st?.host ? `, ${st.host}` : ""}
          </div>
        </div>
        <Stat icon={Users} label="İzlenen hesap" value={online && st ? st.watching : list.length} hint={online ? "Botun takip ettiği" : "Listede kayıtlı"} tone="text-gold" />
        <Stat icon={Radio} label="Şu an canlı" value={online && st ? st.live : "-"} hint="İzleme listesinden" tone="text-live" />
        <Stat icon={Activity} label="Bağlı yayın" value={online && st ? st.connected : "-"} hint="Sandık dinlenen" tone="text-text" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <div className="space-y-6">
          <Panel title="API anahtarı" icon={KeyRound}>
            <AnimatePresence mode="wait">
              {token ? (
                <motion.div key="new" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                  <div className="flex items-start gap-2.5 rounded-xl border border-gold/40 bg-gold/[0.08] p-3 text-[14px] text-gold-soft">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    Bu anahtar bir daha gösterilmeyecek. Şimdi kopyalayıp botun config.json dosyasına yapıştır.
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-line bg-ink p-2 pl-3.5">
                    <code className="min-w-0 flex-1 truncate font-display text-[14px] font-bold tracking-[0.03em]">{token}</code>
                    <CopyBtn text={token} />
                  </div>
                </motion.div>
              ) : (
                <motion.p key="info" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[14px] text-muted">
                  {bot.hasToken
                    ? `Etkin anahtar …${bot.tokenHint} ile bitiyor${bot.tokenCreatedAt ? `, ${new Date(bot.tokenCreatedAt).toLocaleDateString("tr-TR")} tarihinde oluşturuldu` : ""}.`
                    : "Bot siteye bu anahtarla bağlanır. Henüz anahtar oluşturulmadı."}
                </motion.p>
              )}
            </AnimatePresence>
            <button
              onClick={regenerate}
              disabled={tokenBusy}
              className="mt-4 inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-[14px] font-semibold transition-colors hover:border-gold hover:text-gold disabled:opacity-50"
            >
              {tokenBusy ? <Loader2 className="size-4 animate-spin" /> : bot.hasToken ? <RefreshCw className="size-4" /> : <Plus className="size-4" />}
              {bot.hasToken ? "Yeni anahtar oluştur" : "Anahtar oluştur"}
            </button>
          </Panel>

          <Panel title="Bot ayarları" icon={Settings2}>
            <div className="divide-y divide-line">
              <div className="flex items-center justify-between gap-4 pb-4">
                <div>
                  <div className="text-[15px] font-semibold">Onaysız yayınla</div>
                  <div className="mt-0.5 text-[13px] text-muted">Kapalıysa bot yayınları Yayınlar sekmesinde onayını bekler.</div>
                </div>
                <Toggle on={autoPublish} onChange={setAutoPublish} label="Onaysız yayınla" />
              </div>
              <label className="flex items-center justify-between gap-4 py-4">
                <span>
                  <span className="block text-[15px] font-semibold">Ana sayfada kalma süresi</span>
                  <span className="block text-[13px] text-muted">Bot her yeni sandık bildirdiğinde süre baştan başlar.</span>
                </span>
                <span className="flex items-center gap-2">
                  <input type="number" min={1} max={1440} value={duration} onChange={(e) => setDuration(e.target.value)} className="w-24 rounded-xl border border-line bg-ink px-3 py-2.5 text-[15px] tabular-nums outline-none focus:border-gold" />
                  <span className="text-[13px] text-muted">dk</span>
                </span>
              </label>
              <label className="flex items-center justify-between gap-4 pt-4">
                <span>
                  <span className="block text-[15px] font-semibold">Minimum jeton</span>
                  <span className="block text-[13px] text-muted">Toplam sandık jetonu bunun altındaysa yayın eklenmez.</span>
                </span>
                <input type="number" min={0} value={minCoins} onChange={(e) => setMinCoins(e.target.value)} className="w-28 rounded-xl border border-line bg-ink px-3 py-2.5 text-[15px] tabular-nums outline-none focus:border-gold" />
              </label>
            </div>
          </Panel>

          <Panel title="Kurulum" icon={TerminalSquare}>
            <ol className="space-y-4 text-[14px]">
              <li className="flex gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-ink-3 text-[12px] font-bold">1</span>
                <div>
                  Bilgisayarına Python 3.10 ya da üstünü kur. Botun dosyaları{" "}
                  <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-gold hover:underline">
                    GitHub&apos;daki bot klasöründe
                  </a>
                  .
                </div>
              </li>
              <li className="flex gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-ink-3 text-[12px] font-bold">2</span>
                <div className="min-w-0 flex-1">
                  Klasörde paketleri kur:
                  <pre className="mt-2 overflow-x-auto rounded-lg bg-ink p-3 text-[13px]">pip install -r requirements.txt</pre>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-ink-3 text-[12px] font-bold">3</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span>config.json dosyasını şöyle doldur:</span>
                    <CopyBtn text={config} />
                  </div>
                  <pre className="mt-2 overflow-x-auto rounded-lg bg-ink p-3 text-[13px] leading-relaxed">{config}</pre>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-ink-3 text-[12px] font-bold">4</span>
                <div className="min-w-0 flex-1">
                  Botu başlat. Windows&apos;ta baslat.bat dosyasına çift tıklaman yeterli.
                  <pre className="mt-2 overflow-x-auto rounded-lg bg-ink p-3 text-[13px]">python tiktok_jeton_bot.py</pre>
                  <span className="mt-2 block text-muted">Bağlantıyı denemek için: python tiktok_jeton_bot.py --test</span>
                </div>
              </li>
            </ol>
          </Panel>
        </div>

        <Panel
          title="İzleme listesi"
          icon={Bot}
          action={<span className="text-[13px] text-muted tabular-nums">{list.length} hesap</span>}
        >
          <p className="mb-4 text-[14px] text-muted">
            Bot bu hesapların canlı yayına girip girmediğini düzenli kontrol eder. Yayındaysa bağlanıp sandıkları dinler. Liste her dakika bota iletilir, yeniden başlatman gerekmez.
          </p>

          {bulk ? (
            <div className="space-y-2">
              <textarea
                value={add}
                onChange={(e) => setAdd(e.target.value)}
                rows={6}
                placeholder={"Her satıra bir kullanıcı adı ya da TikTok linki\n@kullanici1\nhttps://www.tiktok.com/@kullanici2"}
                className={`${field} resize-y`}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    addNames(add);
                    setBulk(false);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-[14px] font-bold text-ink hover:bg-gold-soft"
                >
                  <ListPlus className="size-4" aria-hidden="true" />
                  {clean(add).length ? `${clean(add).length} hesap ekle` : "Ekle"}
                </button>
                <button type="button" onClick={() => setBulk(false)} className="rounded-xl border border-line px-4 py-2.5 text-[14px] font-semibold text-muted hover:text-text">
                  Vazgeç
                </button>
              </div>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                addNames(add);
              }}
              className="flex gap-2"
            >
              <div className="flex min-w-0 flex-1 items-center rounded-xl border border-line bg-ink focus-within:border-gold">
                <span className="pl-3.5 text-muted">@</span>
                <input
                  value={add}
                  onChange={(e) => setAdd(e.target.value)}
                  placeholder="kullaniciadi"
                  autoCapitalize="none"
                  className="min-w-0 flex-1 bg-transparent px-1.5 py-3 text-[15px] outline-none placeholder:text-muted/60"
                />
              </div>
              <button className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 font-bold text-ink hover:bg-gold-soft">
                <Plus className="size-4" aria-hidden="true" />
                Ekle
              </button>
              <button type="button" onClick={() => setBulk(true)} className="rounded-xl border border-line px-3.5 text-[14px] font-semibold text-muted hover:text-text" title="Toplu ekle">
                <ListPlus className="size-4" aria-label="Toplu ekle" />
              </button>
            </form>
          )}

          {list.length > 8 && (
            <label className="mt-4 flex items-center gap-2 rounded-xl border border-line bg-ink px-3 focus-within:border-gold">
              <Search className="size-4 text-muted" aria-hidden="true" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Listede ara" className="min-w-0 flex-1 bg-transparent py-2.5 text-[14px] outline-none placeholder:text-muted/60" />
            </label>
          )}

          {list.length ? (
            <ul className="mt-4 flex max-h-[520px] flex-wrap gap-2 overflow-y-auto">
              <AnimatePresence initial={false}>
                {shown.map((u) => (
                  <motion.li
                    key={u}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="inline-flex items-center gap-1 rounded-full border border-line bg-ink py-1 pr-1 pl-3 text-[14px]"
                  >
                    <a href={`https://www.tiktok.com/@${u}/live`} target="_blank" rel="noopener noreferrer" className="hover:text-gold">
                      @{u}
                    </a>
                    <button
                      type="button"
                      onClick={() => setList((l) => l.filter((x) => x !== u))}
                      className="grid size-6 place-items-center rounded-full text-muted hover:bg-ink-3 hover:text-live"
                      aria-label={`@${u} listeden çıkar`}
                    >
                      <X className="size-3.5" />
                    </button>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          ) : (
            <p className="mt-4 rounded-xl border border-dashed border-line px-4 py-6 text-center text-[14px] text-muted">
              Liste boş. Sandık dağıtan yayıncıların kullanıcı adlarını ekle.
            </p>
          )}
          {dirty && <p className="mt-4 text-[13px] text-gold">Kaydedilmemiş değişiklik var. Sağ üstten kaydet.</p>}
        </Panel>
      </div>
    </div>
  );
}
