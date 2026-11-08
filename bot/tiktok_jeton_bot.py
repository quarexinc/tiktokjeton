#!/usr/bin/env python3
"""
Tiktok Jetonlu Yayın Bulma - otomatik tarama botu

İzleme listesindeki TikTok hesaplarının canlı yayına girip girmediğini düzenli kontrol eder.
Canlıysa yayına bağlanır, sandık (jeton kutusu) olaylarını dinler ve sandık açıldığında
toplam jeton miktarı, sandık sayısı, bir sonraki sandığın açılma zamanı ve yayın linkiyle
siteye bildirir. Yayın kapanınca siteden de kaldırır.

Kullanım:
    python tiktok_jeton_bot.py              botu başlatır
    python tiktok_jeton_bot.py --test       site bağlantısını ve API anahtarını dener
    python tiktok_jeton_bot.py --check KULLANICI   tek bir hesabın canlı olup olmadığını dener
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import random
import signal
import socket
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Optional

import httpx

VERSION = "1.0.0"
BASE_DIR = Path(__file__).resolve().parent

# ----------------------------------------------------------------------------
# Görünüm
# ----------------------------------------------------------------------------

if os.name == "nt":
    os.system("")  # Windows konsolunda renkleri aç

C = {
    "reset": "\033[0m",
    "dim": "\033[2m",
    "gold": "\033[38;5;220m",
    "pink": "\033[38;5;204m",
    "cyan": "\033[38;5;87m",
    "green": "\033[38;5;114m",
    "red": "\033[38;5;203m",
}


class Fmt(logging.Formatter):
    COLORS = {logging.WARNING: C["gold"], logging.ERROR: C["red"], logging.DEBUG: C["dim"]}

    def format(self, record: logging.LogRecord) -> str:
        t = time.strftime("%H:%M:%S", time.localtime(record.created))
        color = self.COLORS.get(record.levelno, "")
        return f"{C['dim']}{t}{C['reset']} {color}{record.getMessage()}{C['reset']}"


log = logging.getLogger("tjbot")


def setup_logging(verbose: bool) -> None:
    h = logging.StreamHandler(sys.stdout)
    h.setFormatter(Fmt())
    log.addHandler(h)
    log.setLevel(logging.DEBUG if verbose else logging.INFO)
    # Kütüphanelerin gürültüsünü kıs
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("TikTokLive").setLevel(logging.CRITICAL)


def coins_text(n: int) -> str:
    return f"{n:,}".replace(",", ".")


# ----------------------------------------------------------------------------
# Ayarlar
# ----------------------------------------------------------------------------


@dataclass
class Config:
    site_url: str
    api_key: str
    extra_usernames: list[str] = field(default_factory=list)
    check_interval_sec: int = 120
    max_connections: int = 25
    heartbeat_sec: int = 60
    keepalive_sec: int = 180
    sign_api_key: str = ""
    proxy: str = ""

    @classmethod
    def load(cls, path: Path) -> "Config":
        data: Dict[str, Any] = {}
        if path.exists():
            data = json.loads(path.read_text(encoding="utf-8"))
        # Ortam değişkenleri dosyadaki değerleri ezer
        data["site_url"] = os.environ.get("TJ_SITE_URL", data.get("site_url", ""))
        data["api_key"] = os.environ.get("TJ_API_KEY", data.get("api_key", ""))
        known = {f for f in cls.__dataclass_fields__}
        cfg = cls(**{k: v for k, v in data.items() if k in known})
        cfg.site_url = cfg.site_url.rstrip("/")
        cfg.extra_usernames = [clean_username(u) for u in cfg.extra_usernames if clean_username(u)]
        cfg.check_interval_sec = max(30, int(cfg.check_interval_sec))
        cfg.max_connections = max(1, int(cfg.max_connections))
        return cfg

    def validate(self) -> Optional[str]:
        if not self.site_url.startswith("http"):
            return "config.json içinde site_url eksik. Örnek: https://tiktokjeton.vercel.app"
        if not self.api_key or self.api_key.startswith("BURAYA"):
            return "config.json içinde api_key eksik. Admin paneli > Otomasyon > API anahtarı bölümünden oluştur."
        return None


def clean_username(u: str) -> str:
    u = (u or "").strip()
    if "tiktok.com/@" in u:
        u = u.split("tiktok.com/@", 1)[1].split("/")[0].split("?")[0]
    return u.lstrip("@").lower()


# ----------------------------------------------------------------------------
# Site API
# ----------------------------------------------------------------------------


class SiteAPI:
    def __init__(self, cfg: Config):
        self.cfg = cfg
        self.http = httpx.AsyncClient(
            base_url=cfg.site_url,
            headers={"Authorization": f"Bearer {cfg.api_key}", "User-Agent": f"tiktok-jeton-bot/{VERSION}"},
            timeout=20,
        )
        self._lock = asyncio.Lock()  # Site tarafında yazmalar sırayla gitsin

    async def _post(self, path: str, body: dict, retries: int = 3) -> Optional[dict]:
        for attempt in range(retries):
            try:
                async with self._lock:
                    r = await self.http.post(path, json=body)
                data = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
                if r.status_code == 401:
                    log.error(f"Site API anahtarını kabul etmedi: {data.get('error', '')}")
                    return None
                if r.status_code >= 500 or r.status_code == 429:
                    raise httpx.HTTPStatusError(data.get("error", str(r.status_code)), request=r.request, response=r)
                if r.status_code >= 400:
                    log.warning(f"Site isteği reddetti ({path}): {data.get('error', r.status_code)}")
                    return None
                return data
            except (httpx.HTTPError, ValueError) as e:
                wait = 2 ** attempt + random.random()
                log.debug(f"Site isteği başarısız ({path}): {e}. {wait:.0f} sn sonra tekrar")
                await asyncio.sleep(wait)
        log.warning(f"Siteye ulaşılamadı: {path}")
        return None

    async def heartbeat(self, status: dict) -> Optional[dict]:
        r = await self._post("/api/bot/heartbeat", {**status, "version": VERSION, "host": socket.gethostname()[:60]})
        return r.get("config") if r else None

    async def report(self, payload: dict) -> Optional[dict]:
        return await self._post("/api/bot/report", payload)

    async def end(self, username: str) -> None:
        await self._post("/api/bot/end", {"username": username})

    async def close(self) -> None:
        await self.http.aclose()


# ----------------------------------------------------------------------------
# Sandık takibi
# ----------------------------------------------------------------------------


@dataclass
class Chest:
    id: str
    coins: int
    people: int
    unpack_at: int  # unix saniye
    sender: str


@dataclass
class StreamState:
    """Bir yayıncının anlık sandık durumu. TikTok bağlantısından bağımsız test edilebilir."""

    username: str
    chests: Dict[str, Chest] = field(default_factory=dict)
    viewers: Optional[int] = None
    title: str = ""
    reported: bool = False
    last_report_key: Optional[tuple] = None
    last_report_at: float = 0.0

    def add_chest(self, chest: Chest) -> bool:
        new = chest.id not in self.chests
        self.chests[chest.id] = chest
        return new

    def remove_chest(self, chest_id: str) -> None:
        self.chests.pop(chest_id, None)

    def prune(self, now: float, grace: int = 45) -> int:
        """Açılma zamanı üzerinden belli süre geçmiş sandıkları düşür."""
        gone = [cid for cid, c in self.chests.items() if c.unpack_at and c.unpack_at + grace < now]
        for cid in gone:
            del self.chests[cid]
        return len(gone)

    def payload(self, now: float) -> dict:
        active = list(self.chests.values())
        coins = sum(c.coins for c in active)
        upcoming = [c.unpack_at for c in active if c.unpack_at and c.unpack_at > now]
        next_at = min(upcoming) if upcoming else None
        if active:
            title = f"{len(active)} sandık, toplam {coins_text(coins)} jeton"
        else:
            title = self.title[:120] if self.title else ""
        return {
            "username": self.username,
            "coins": coins,
            "chests": len(active),
            "nextChestAt": next_at,
            "viewers": self.viewers,
            "title": title,
            "url": f"https://www.tiktok.com/@{self.username}/live",
        }


# ----------------------------------------------------------------------------
# Yayıncı izleyicisi
# ----------------------------------------------------------------------------


class Watcher:
    def __init__(self, username: str, bot: "Bot"):
        self.username = username
        self.bot = bot
        self.state = StreamState(username)
        self.client = None
        self.task: Optional[asyncio.Task] = None
        self.live = False
        self.connected = False
        self.next_check = time.time() + random.uniform(0, 15)
        self.fail_count = 0
        self._report_soon: Optional[asyncio.Task] = None

    # -- TikTok bağlantısı --

    async def connect(self) -> None:
        from TikTokLive import TikTokLiveClient
        from TikTokLive.events import (
            ConnectEvent,
            DisconnectEvent,
            EnvelopeEvent,
            LiveEndEvent,
            RoomUserSeqEvent,
        )

        client = TikTokLiveClient(unique_id=f"@{self.username}", **self.bot.client_kwargs())
        self.client = client

        @client.on(ConnectEvent)
        async def _on_connect(_: ConnectEvent) -> None:
            self.connected = True
            log.info(f"{C['cyan']}@{self.username}{C['reset']} yayınına bağlanıldı, sandıklar dinleniyor")

        @client.on(EnvelopeEvent)
        async def _on_envelope(event: EnvelopeEvent) -> None:
            self.handle_envelope(event)

        @client.on(RoomUserSeqEvent)
        async def _on_viewers(event: RoomUserSeqEvent) -> None:
            try:
                self.state.viewers = int(event.total)
            except Exception:
                pass

        @client.on(LiveEndEvent)
        async def _on_end(_: LiveEndEvent) -> None:
            log.info(f"@{self.username} yayını bitirdi")
            await self.finish()

        @client.on(DisconnectEvent)
        async def _on_disconnect(_: DisconnectEvent) -> None:
            if self.connected:
                log.debug(f"@{self.username} bağlantısı kapandı")
            self.connected = False

        self.task = await client.start(fetch_room_info=True)
        try:
            info = client.room_info or {}
            self.state.title = str(info.get("title") or "")
        except Exception:
            pass
        self.live = True
        self.task.add_done_callback(lambda _t: asyncio.ensure_future(self._on_task_done()))

    async def _on_task_done(self) -> None:
        was = self.live
        self.connected = False
        self.client = None
        self.task = None
        if was:
            # Bağlantı koptu: yayın hâlâ açık olabilir, kısa süre sonra tekrar kontrol et
            self.next_check = time.time() + 20
            self.live = False

    def handle_envelope(self, event: Any) -> None:
        info = getattr(event, "envelope_info", None)
        if info is None:
            return
        cid = str(getattr(info, "envelope_id", "") or f"{info.unpack_at}-{info.diamond_count}")
        display = getattr(event, "display", None)
        hidden = getattr(display, "name", str(display)) == "HIDE"
        if hidden:
            self.state.remove_chest(cid)
            log.debug(f"@{self.username} sandığı kapandı ({cid})")
        else:
            chest = Chest(
                id=cid,
                coins=int(info.diamond_count or 0),
                people=int(info.people_count or 0),
                unpack_at=int(info.unpack_at or 0),
                sender=str(info.send_user_name or ""),
            )
            if self.state.add_chest(chest):
                wait = max(0, chest.unpack_at - int(time.time()))
                log.info(
                    f"{C['gold']}Sandık{C['reset']} @{self.username}: {C['gold']}{coins_text(chest.coins)} jeton{C['reset']}, "
                    f"{chest.people} kişi, {wait // 60} dk {wait % 60} sn sonra açılıyor"
                )
        self.schedule_report()

    def schedule_report(self, delay: float = 2.0) -> None:
        """Art arda gelen olayları tek bir bildirime topla."""
        if self._report_soon and not self._report_soon.done():
            return

        async def run() -> None:
            await asyncio.sleep(delay)
            await self.report()

        self._report_soon = asyncio.ensure_future(run())

    async def report(self, force: bool = False) -> None:
        now = time.time()
        self.state.prune(now)
        p = self.state.payload(now)
        key = (p["coins"], p["chests"], p["nextChestAt"])
        if not force and key == self.state.last_report_key:
            return
        if not self.state.reported and p["chests"] == 0:
            return  # Sandık görmeden siteye yayın ekleme
        r = await self.bot.api.report(p)
        if not r:
            return
        self.state.last_report_key = key
        self.state.last_report_at = now
        result = r.get("result")
        if result == "created":
            self.state.reported = True
            msg = "onaya gönderildi" if r.get("pending") else "siteye eklendi"
            log.info(f"{C['green']}@{self.username} {msg}{C['reset']} ({coins_text(p['coins'])} jeton, {p['chests']} sandık)")
        elif result == "updated":
            self.state.reported = True
            log.debug(f"@{self.username} sitede güncellendi")
        elif result == "skipped":
            log.info(f"@{self.username} eklenmedi: {r.get('reason', '')}")

    async def keepalive(self) -> None:
        """Sandık varken sitedeki yayını canlı tut."""
        if not self.state.reported:
            return
        now = time.time()
        self.state.prune(now)
        if self.state.chests and now - self.state.last_report_at > self.bot.cfg.keepalive_sec:
            await self.report(force=True)
        elif self.state.last_report_key and self.state.last_report_key[1] != len(self.state.chests):
            await self.report()

    async def finish(self) -> None:
        """Yayın bitti: bağlantıyı kapat, siteden kaldır."""
        if self.state.reported:
            await self.bot.api.end(self.username)
            log.info(f"@{self.username} siteden kaldırıldı")
        self.state = StreamState(self.username)
        self.live = False
        self.connected = False
        client, self.client = self.client, None
        if client:
            try:
                await client.disconnect()
            except Exception:
                pass
        self.next_check = time.time() + self.bot.cfg.check_interval_sec

    async def check(self) -> None:
        """Canlı mı diye bak, canlıysa bağlan."""
        from TikTokLive.client.errors import UserNotFoundError, UserOfflineError

        try:
            live = await self.bot.is_live(self.username)
        except UserNotFoundError:
            log.warning(f"@{self.username} bulunamadı, 30 dk sonra tekrar denenecek")
            self.next_check = time.time() + 1800
            return
        except Exception as e:
            self.fail_count += 1
            backoff = min(1800, self.bot.cfg.check_interval_sec * (2 ** min(self.fail_count, 4)))
            log.debug(f"@{self.username} kontrol edilemedi: {type(e).__name__}: {e}")
            self.next_check = time.time() + backoff
            return

        self.fail_count = 0
        if not live:
            if self.state.reported:
                await self.finish()
            self.next_check = time.time() + self.bot.cfg.check_interval_sec * random.uniform(0.85, 1.15)
            return

        if self.bot.connected_count() >= self.bot.cfg.max_connections:
            log.debug(f"@{self.username} canlı ama bağlantı sınırı dolu")
            self.next_check = time.time() + 60
            return

        log.info(f"{C['pink']}@{self.username} canlı{C['reset']}, bağlanılıyor")
        try:
            await self.connect()
        except UserOfflineError:
            self.next_check = time.time() + self.bot.cfg.check_interval_sec
        except Exception as e:
            log.warning(f"@{self.username} yayınına bağlanılamadı: {type(e).__name__}: {e}")
            self.client = None
            self.next_check = time.time() + max(120, self.bot.cfg.check_interval_sec)

    async def stop(self) -> None:
        client, self.client = self.client, None
        if client:
            try:
                await client.disconnect()
            except Exception:
                pass


# ----------------------------------------------------------------------------
# Ana bot
# ----------------------------------------------------------------------------


class Bot:
    def __init__(self, cfg: Config):
        self.cfg = cfg
        self.api = SiteAPI(cfg)
        self.watchers: Dict[str, Watcher] = {}
        self.site_watchlist: list[str] = []
        self.stopping = asyncio.Event()
        self._checker = None
        self._check_sem = asyncio.Semaphore(3)  # Aynı anda en fazla 3 canlı kontrolü
        if cfg.sign_api_key:
            os.environ["SIGN_API_KEY"] = cfg.sign_api_key

    def client_kwargs(self) -> dict:
        if not self.cfg.proxy:
            return {}
        return {"web_proxy": httpx.Proxy(self.cfg.proxy)}

    async def is_live(self, username: str) -> bool:
        from TikTokLive import TikTokLiveClient

        async with self._check_sem:
            if self._checker is None:
                self._checker = TikTokLiveClient(unique_id="tiktok", **self.client_kwargs())
            result = await self._checker.web.fetch_is_live(unique_id=username)
            await asyncio.sleep(random.uniform(0.8, 2.0))  # TikTok'u yormamak için
            return bool(result)

    def connected_count(self) -> int:
        return sum(1 for w in self.watchers.values() if w.client is not None)

    def status(self) -> dict:
        return {
            "watching": len(self.watchers),
            "live": sum(1 for w in self.watchers.values() if w.live),
            "connected": sum(1 for w in self.watchers.values() if w.connected),
        }

    def sync_watchers(self) -> None:
        wanted = set(self.site_watchlist) | set(self.cfg.extra_usernames)
        for u in wanted - set(self.watchers):
            self.watchers[u] = Watcher(u, self)
            log.debug(f"@{u} izleme listesine eklendi")
        for u in set(self.watchers) - wanted:
            w = self.watchers.pop(u)
            asyncio.ensure_future(w.finish())
            log.info(f"@{u} izleme listesinden çıkarıldı")

    async def heartbeat_loop(self) -> None:
        first = True
        while not self.stopping.is_set():
            cfg = await self.api.heartbeat(self.status())
            if cfg is not None:
                self.site_watchlist = [clean_username(u) for u in cfg.get("watchlist", []) if clean_username(u)]
                before = len(self.watchers)
                self.sync_watchers()
                if first or len(self.watchers) != before:
                    log.info(f"İzleme listesi: {len(self.watchers)} hesap")
                first = False
            elif first:
                log.error("Siteden ayarlar alınamadı. site_url ve api_key değerlerini kontrol et.")
            await self._sleep(self.cfg.heartbeat_sec)

    async def check_loop(self) -> None:
        while not self.stopping.is_set():
            now = time.time()
            due = [w for w in self.watchers.values() if w.client is None and w.next_check <= now]
            due.sort(key=lambda w: w.next_check)
            for w in due[:10]:
                if self.stopping.is_set():
                    break
                w.next_check = now + 3600  # Kontrol sürerken tekrar sıraya girmesin
                await w.check()
            await self._sleep(2)

    async def keepalive_loop(self) -> None:
        while not self.stopping.is_set():
            for w in list(self.watchers.values()):
                try:
                    await w.keepalive()
                except Exception as e:
                    log.debug(f"@{w.username} güncellenemedi: {e}")
            await self._sleep(15)

    async def status_loop(self) -> None:
        while not self.stopping.is_set():
            await self._sleep(300)
            s = self.status()
            chests = sum(len(w.state.chests) for w in self.watchers.values())
            log.info(
                f"{C['dim']}Durum: {s['watching']} hesap izleniyor, {s['live']} canlı, "
                f"{s['connected']} yayına bağlı, {chests} açılmamış sandık{C['reset']}"
            )

    async def _sleep(self, sec: float) -> None:
        try:
            await asyncio.wait_for(self.stopping.wait(), timeout=sec)
        except asyncio.TimeoutError:
            pass

    async def run(self) -> None:
        log.info(f"{C['gold']}Tiktok Jetonlu Yayın Bulma botu {VERSION}{C['reset']} başlıyor, site: {self.cfg.site_url}")
        loops = [
            asyncio.ensure_future(self.heartbeat_loop()),
            asyncio.ensure_future(self.check_loop()),
            asyncio.ensure_future(self.keepalive_loop()),
            asyncio.ensure_future(self.status_loop()),
        ]
        await self.stopping.wait()
        log.info("Kapatılıyor, açık yayınlar siteden kaldırılıyor...")
        for w in list(self.watchers.values()):
            if w.state.reported:
                await self.api.end(w.username)
            await w.stop()
        for t in loops:
            t.cancel()
        await self.api.close()
        log.info("Bot kapandı.")


# ----------------------------------------------------------------------------
# Komutlar
# ----------------------------------------------------------------------------


async def cmd_test(cfg: Config) -> int:
    api = SiteAPI(cfg)
    log.info(f"Siteye bağlanılıyor: {cfg.site_url}")
    conf = await api.heartbeat({"watching": 0, "live": 0, "connected": 0})
    await api.close()
    if conf is None:
        log.error("Bağlantı başarısız. site_url ve api_key değerlerini kontrol et.")
        return 1
    log.info(f"{C['green']}Bağlantı başarılı.{C['reset']} Admin panelinde bot 'Çalışıyor' görünmeli.")
    log.info(f"İzleme listesinde {len(conf.get('watchlist', []))} hesap var. Onaysız yayınla: {'açık' if conf.get('autoPublish') else 'kapalı'}")
    return 0


async def cmd_check(cfg: Config, username: str) -> int:
    bot = Bot(cfg)
    u = clean_username(username)
    log.info(f"@{u} kontrol ediliyor...")
    try:
        live = await bot.is_live(u)
    except Exception as e:
        log.error(f"Kontrol edilemedi: {type(e).__name__}: {e}")
        return 1
    finally:
        await bot.api.close()
    log.info(f"@{u} şu an {'canlı' if live else 'canlı değil'}")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="Tiktok Jetonlu Yayın Bulma botu")
    ap.add_argument("--config", default=str(BASE_DIR / "config.json"), help="Ayar dosyası (varsayılan: config.json)")
    ap.add_argument("--test", action="store_true", help="Site bağlantısını ve API anahtarını dene")
    ap.add_argument("--check", metavar="KULLANICI", help="Tek bir hesabın canlı olup olmadığını dene")
    ap.add_argument("-v", "--verbose", action="store_true", help="Ayrıntılı kayıt")
    args = ap.parse_args()

    setup_logging(args.verbose)
    cfg_path = Path(args.config)
    if not cfg_path.exists() and not os.environ.get("TJ_API_KEY"):
        example = BASE_DIR / "config.example.json"
        log.error(f"{cfg_path.name} bulunamadı. {example.name} dosyasını {cfg_path.name} adıyla kopyalayıp doldur.")
        return 1
    cfg = Config.load(cfg_path)
    err = cfg.validate()
    if err:
        log.error(err)
        return 1

    if args.test:
        return asyncio.run(cmd_test(cfg))
    if args.check:
        return asyncio.run(cmd_check(cfg, args.check))

    async def runner() -> None:
        bot = Bot(cfg)
        loop = asyncio.get_running_loop()
        for sig in (signal.SIGINT, signal.SIGTERM):
            try:
                loop.add_signal_handler(sig, bot.stopping.set)
            except (NotImplementedError, RuntimeError):
                pass  # Windows: Ctrl+C KeyboardInterrupt olarak gelir
        try:
            await bot.run()
        except asyncio.CancelledError:
            pass
        finally:
            if not bot.stopping.is_set():
                bot.stopping.set()

    try:
        asyncio.run(runner())
    except KeyboardInterrupt:
        log.info("Durduruldu.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
