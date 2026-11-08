#!/usr/bin/env python3
"""
Tiktok Jetonlu Yayın Bulma - otomatik keşif ve sandık tarama botu

Bot, VDS üzerinde 7/24 çalışmak için tasarlandı ve elle hesap girilmesini beklemez:

1. Keşif: Bağlandığı her canlı yayında PK/battle eşleşmelerini, ortak yayın (co-host)
   listelerini, saatlik sıralama listelerini ve banner'ları okur. Bu mesajlarda geçen
   yayıncıları (çoğunun o an açık oda numarasıyla birlikte) keşif havuzuna ekler.
   Böylece birkaç yayından başlayıp kartopu gibi yayılır.
2. Doğrulama: Havuzdaki hesapların canlı olup olmadığını TikTok'un toplu oda kontrolüyle
   (tek istekte 20 oda) doğrular.
3. Yoklama: Canlı hesaplara sırayla kısa süre (varsayılan 2 dk) bağlanıp sandık olup
   olmadığına bakar. Sandık görürse yayını "tutar", siteye ekler ve sandık bitene kadar
   izler. Görmezse bağlantıyı kapatıp sıradakine geçer.
4. Öğrenme: Sandık görülen hesaplar havuzda öne çıkar ve daha sık yoklanır.

Havuz kesif.db (SQLite) dosyasında saklanır; bot yeniden başlasa da öğrendiklerini unutmaz.

Kullanım:
    python tiktok_jeton_bot.py              botu başlatır
    python tiktok_jeton_bot.py --test       site bağlantısını ve API anahtarını dener
    python tiktok_jeton_bot.py --check KULLANICI   tek bir hesabın canlı olup olmadığını dener
    python tiktok_jeton_bot.py --stats      keşif havuzunun özetini gösterir
"""

from __future__ import annotations

import argparse
import asyncio
import json
import re
import logging
import logging.handlers
import os
import random
import signal
import socket
import sqlite3
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Set, Tuple

import httpx

VERSION = "2.3.0"
BASE_DIR = Path(__file__).resolve().parent

# ----------------------------------------------------------------------------
# Görünüm ve kayıt
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


class ConsoleFmt(logging.Formatter):
    COLORS = {logging.WARNING: C["gold"], logging.ERROR: C["red"], logging.DEBUG: C["dim"]}

    def format(self, record: logging.LogRecord) -> str:
        t = time.strftime("%H:%M:%S", time.localtime(record.created))
        color = self.COLORS.get(record.levelno, "")
        return f"{C['dim']}{t}{C['reset']} {color}{record.getMessage()}{C['reset']}"


class FileFmt(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        t = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(record.created))
        msg = record.getMessage()
        for code in C.values():
            msg = msg.replace(code, "")
        return f"{t} {record.levelname:<7} {msg}"


log = logging.getLogger("tjbot")


def setup_logging(verbose: bool, log_file: str = "") -> None:
    log.handlers.clear()
    h = logging.StreamHandler(sys.stdout)
    h.setFormatter(ConsoleFmt())
    log.addHandler(h)
    if log_file:
        path = Path(log_file)
        if not path.is_absolute():
            path = BASE_DIR / path
        path.parent.mkdir(parents=True, exist_ok=True)
        fh = logging.handlers.RotatingFileHandler(path, maxBytes=5_000_000, backupCount=5, encoding="utf-8")
        fh.setFormatter(FileFmt())
        log.addHandler(fh)
    log.setLevel(logging.DEBUG if verbose else logging.INFO)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("TikTokLive").setLevel(logging.CRITICAL)


def coins_text(n: int) -> str:
    return f"{n:,}".replace(",", ".")


def clean_username(u: Any) -> str:
    u = str(u or "").strip()
    if "tiktok.com/@" in u:
        u = u.split("tiktok.com/@", 1)[1].split("/")[0].split("?")[0]
    u = u.lstrip("@").lower()
    if 2 <= len(u) <= 24 and all(ch.isalnum() or ch in "._" for ch in u):
        return u
    return ""


# ----------------------------------------------------------------------------
# Ayarlar
# ----------------------------------------------------------------------------


@dataclass
class Config:
    site_url: str
    api_key: str
    # Keşif
    discovery: bool = True
    feed_discovery: bool = True
    seed_usernames: List[str] = field(default_factory=list)
    extra_usernames: List[str] = field(default_factory=list)  # eski sürümle uyum: tohum gibi davranır
    region: str = "TR"
    # Bağlantılar
    max_connections: int = 60  # aynı anda yoklanan (aranan) yayın sayısı
    max_hold: int = 60  # sandık bulunup takip edilen yayın sayısı (aramayı yavaşlatmaz)
    parallel_starts: int = 8
    probe_seconds: int = 60
    linger_minutes: int = 8
    start_interval_sec: float = 0.3
    # Yeniden yoklama aralıkları (dakika)
    probe_cooldown_min: int = 15
    hot_cooldown_min: int = 4
    pinned_check_sec: int = 90
    # Havuz
    pool_max: int = 30000
    data_file: str = "kesif.db"
    # Site
    heartbeat_sec: int = 60
    keepalive_sec: int = 180
    # Diğer
    sign_api_key: str = ""
    proxy: str = ""
    log_file: str = "logs/bot.log"

    @classmethod
    def load(cls, path: Path) -> "Config":
        data: Dict[str, Any] = {}
        if path.exists():
            data = json.loads(path.read_text(encoding="utf-8"))
        data["site_url"] = os.environ.get("TJ_SITE_URL", data.get("site_url", ""))
        data["api_key"] = os.environ.get("TJ_API_KEY", data.get("api_key", ""))
        # Eski ayar adı
        if "check_interval_sec" in data and "pinned_check_sec" not in data:
            data["pinned_check_sec"] = data["check_interval_sec"]
        known = set(cls.__dataclass_fields__)
        cfg = cls(**{k: v for k, v in data.items() if k in known})
        cfg.site_url = cfg.site_url.rstrip("/")
        cfg.seed_usernames = [u for u in map(clean_username, cfg.seed_usernames + cfg.extra_usernames) if u]
        cfg.max_connections = max(1, int(cfg.max_connections))
        cfg.probe_seconds = max(30, int(cfg.probe_seconds))
        cfg.parallel_starts = max(1, min(20, int(cfg.parallel_starts)))
        cfg.max_hold = max(1, int(cfg.max_hold))
        cfg.region = (cfg.region or "TR").upper()[:2]
        cfg.pinned_check_sec = max(30, int(cfg.pinned_check_sec))
        return cfg

    def validate(self) -> Optional[str]:
        if not self.site_url.startswith("http"):
            return "config.json içinde site_url eksik. Örnek: https://tiktokjeton.vercel.app"
        if not self.api_key or self.api_key.startswith("BURAYA"):
            return "config.json içinde api_key eksik. Admin paneli > Otomasyon > API anahtarı bölümünden oluştur."
        return None


# ----------------------------------------------------------------------------
# Site API
# ----------------------------------------------------------------------------


class SiteAPI:
    def __init__(self, cfg: Config):
        self.http = httpx.AsyncClient(
            base_url=cfg.site_url,
            headers={"Authorization": f"Bearer {cfg.api_key}", "User-Agent": f"tiktok-jeton-bot/{VERSION}"},
            timeout=20,
        )
        self._lock = asyncio.Lock()

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
                    raise httpx.HTTPStatusError(str(data.get("error", r.status_code)), request=r.request, response=r)
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
# Keşif havuzu (SQLite)
# ----------------------------------------------------------------------------


class Pool:
    """Keşfedilen yayıncılar ve ne zaman yeniden bakılacakları."""

    def __init__(self, path: Path):
        self.db = sqlite3.connect(path)
        self.db.row_factory = sqlite3.Row
        self.db.execute("PRAGMA journal_mode=WAL")
        self.db.execute(
            """CREATE TABLE IF NOT EXISTS accounts (
                username TEXT PRIMARY KEY,
                room_id TEXT,
                source TEXT,
                added REAL,
                last_live REAL DEFAULT 0,
                last_probe REAL DEFAULT 0,
                next_check REAL DEFAULT 0,
                probes INTEGER DEFAULT 0,
                misses INTEGER DEFAULT 0,
                chest_hits INTEGER DEFAULT 0,
                coins_total INTEGER DEFAULT 0,
                last_chest REAL DEFAULT 0,
                pinned INTEGER DEFAULT 0
            )"""
        )
        cols = {r[1] for r in self.db.execute("PRAGMA table_info(accounts)")}
        if "hot_until" not in cols:
            self.db.execute("ALTER TABLE accounts ADD COLUMN hot_until REAL DEFAULT 0")
        self.db.execute("CREATE INDEX IF NOT EXISTS idx_next ON accounts(next_check)")
        self.db.execute("CREATE TABLE IF NOT EXISTS anchors (user_id TEXT PRIMARY KEY, username TEXT, ts REAL)")
        self.db.commit()

    def anchor_name(self, user_id: int) -> Optional[str]:
        r = self.db.execute("SELECT username FROM anchors WHERE user_id=?", (str(user_id),)).fetchone()
        return r["username"] if r else None

    def save_anchor(self, user_id: int, username: str, now: float) -> None:
        self.db.execute(
            "INSERT INTO anchors(user_id, username, ts) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET username=excluded.username, ts=excluded.ts",
            (str(user_id), username, now),
        )

    def mark_hot(self, username: str, until: float, now: float) -> None:
        """Sıcak ipucu: bir süre listenin en başına al."""
        self.db.execute(
            "UPDATE accounts SET hot_until=MAX(hot_until, ?), next_check=MIN(next_check, ?) WHERE username=?",
            (until, now, username),
        )

    def add(self, username: str, room_id: Optional[int | str], source: str, live_now: bool, now: float) -> bool:
        """Yeni hesap eklendiyse True döner."""
        rid = str(room_id) if room_id else None
        cur = self.db.execute("SELECT username, room_id, next_check FROM accounts WHERE username=?", (username,))
        row = cur.fetchone()
        if row is None:
            self.db.execute(
                "INSERT INTO accounts(username, room_id, source, added, last_live, next_check) VALUES(?,?,?,?,?,?)",
                (username, rid, source, now, now if live_now else 0, now),
            )
            return True
        if rid and rid != row["room_id"]:
            # Yeni oda = yeni canlı yayın: hemen bakılabilir
            self.db.execute(
                "UPDATE accounts SET room_id=?, last_live=?, next_check=MIN(next_check, ?) WHERE username=?",
                (rid, now, now, username),
            )
        elif live_now:
            self.db.execute("UPDATE accounts SET last_live=? WHERE username=?", (now, username))
        return False

    def set_pinned(self, usernames: Set[str], now: float) -> None:
        self.db.execute("UPDATE accounts SET pinned=0 WHERE pinned=1")
        for u in usernames:
            self.add(u, None, "liste", False, now)
        if usernames:
            self.db.executemany("UPDATE accounts SET pinned=1 WHERE username=?", [(u,) for u in usernames])
        self.db.commit()

    def candidates(self, now: float, exclude: Set[str], limit: int) -> List[sqlite3.Row]:
        rows = self.db.execute(
            """SELECT * FROM accounts WHERE next_check <= ?
               ORDER BY pinned DESC,
                        (hot_until > ?) DESC,
                        (chest_hits > 0) DESC,
                        (room_id IS NOT NULL) DESC,
                        last_chest DESC,
                        last_live DESC
               LIMIT ?""",
            (now, now, limit + len(exclude)),
        ).fetchall()
        return [r for r in rows if r["username"] not in exclude][:limit]

    def backlog(self, now: float, exclude: Set[str], limit: int, min_gap: float = 300) -> List[sqlite3.Row]:
        """Sırası gelmemiş ama en az min_gap sn önce bakılmış hesaplar: tarama hiç durmasın diye."""
        rows = self.db.execute(
            """SELECT * FROM accounts WHERE next_check > ? AND last_probe < ? AND next_check < ?
               ORDER BY (chest_hits > 0) DESC, (room_id IS NOT NULL) DESC, last_probe ASC
               LIMIT ?""",
            (now, now - min_gap, now + 6 * 3600, limit + len(exclude)),
        ).fetchall()
        return [r for r in rows if r["username"] not in exclude][:limit]

    def schedule(self, username: str, at: float) -> None:
        self.db.execute("UPDATE accounts SET next_check=? WHERE username=?", (at, username))

    def mark_offline(self, username: str, now: float, cfg: Config) -> None:
        row = self.db.execute("SELECT pinned, chest_hits, last_live FROM accounts WHERE username=?", (username,)).fetchone()
        if row is None:
            return
        if row["pinned"]:
            wait = cfg.pinned_check_sec
        elif row["chest_hits"] > 0:
            wait = 15 * 60
        elif now - (row["last_live"] or 0) > 3 * 86400:
            wait = 6 * 3600
        else:
            wait = 60 * 60
        self.db.execute(
            "UPDATE accounts SET room_id=NULL, next_check=? WHERE username=?",
            (now + wait * random.uniform(0.85, 1.15), username),
        )

    def mark_probe(self, username: str, now: float, chest: bool, coins: int, cfg: Config) -> None:
        if chest:
            self.db.execute(
                """UPDATE accounts SET last_probe=?, last_live=?, probes=probes+1, misses=0,
                   chest_hits=chest_hits+1, coins_total=coins_total+?, last_chest=?, next_check=?
                   WHERE username=?""",
                (now, now, coins, now, now + cfg.hot_cooldown_min * 60, username),
            )
            return
        row = self.db.execute("SELECT misses, chest_hits, pinned FROM accounts WHERE username=?", (username,)).fetchone()
        misses = (row["misses"] if row else 0) + 1
        if row and row["pinned"]:
            wait = cfg.pinned_check_sec
        elif row and row["chest_hits"] > 0:
            wait = cfg.hot_cooldown_min * 60 * min(1 + misses * 0.5, 4)
        else:
            wait = cfg.probe_cooldown_min * 60 * min(1 + misses * 0.5, 6)
        self.db.execute(
            "UPDATE accounts SET last_probe=?, last_live=?, probes=probes+1, misses=?, next_check=? WHERE username=?",
            (now, now, misses, now + wait * random.uniform(0.85, 1.15), username),
        )

    def stats(self, now: float) -> dict:
        q = lambda sql, *a: self.db.execute(sql, a).fetchone()[0]  # noqa: E731
        return {
            "pool": q("SELECT COUNT(*) FROM accounts"),
            "withChests": q("SELECT COUNT(*) FROM accounts WHERE chest_hits > 0"),
            "discoveredToday": q("SELECT COUNT(*) FROM accounts WHERE added > ?", now - 86400),
            "liveRecently": q("SELECT COUNT(*) FROM accounts WHERE last_live > ?", now - 1800),
        }

    def top(self, limit: int = 15) -> List[sqlite3.Row]:
        return self.db.execute(
            "SELECT * FROM accounts WHERE chest_hits > 0 ORDER BY chest_hits DESC, coins_total DESC LIMIT ?", (limit,)
        ).fetchall()

    def prune(self, max_rows: int, now: float) -> int:
        n = self.db.execute("SELECT COUNT(*) FROM accounts").fetchone()[0]
        if n <= max_rows:
            return 0
        extra = n - max_rows
        cur = self.db.execute(
            """DELETE FROM accounts WHERE username IN (
                 SELECT username FROM accounts WHERE pinned=0 AND chest_hits=0
                 ORDER BY last_live ASC, added ASC LIMIT ?)""",
            (extra,),
        )
        return cur.rowcount

    def commit(self) -> None:
        self.db.commit()


# ----------------------------------------------------------------------------
# Mesajlardan yayıncı çıkarma
# ----------------------------------------------------------------------------

DISCOVERY_EVENTS = {
    "LinkMicBattleEvent": "pk",
    "LinkMicArmiesEvent": "pk",
    "LinkMicMethodEvent": "ortak yayın",
    "LinkEvent": "ortak yayın",
    "LinkLayerEvent": "ortak yayın",
    "RankUpdateEvent": "sıralama",
    "HourlyRankRewardEvent": "sıralama",
    "InRoomBannerEvent": "banner",
}

_SCALARS = (str, int, float, bool, bytes)


def extract_anchors(obj: Any, depth: int = 0, out: Optional[Dict[str, Optional[int]]] = None) -> Dict[str, Optional[int]]:
    """Bir protobuf mesajının içindeki tüm kullanıcıları (kullanıcı adı -> açık oda no) toplar."""
    if out is None:
        out = {}
    if depth > 8 or obj is None or isinstance(obj, _SCALARS):
        return out
    if isinstance(obj, (list, tuple)):
        for x in obj:
            extract_anchors(x, depth + 1, out)
        return out
    if isinstance(obj, dict):
        for x in obj.values():
            extract_anchors(x, depth + 1, out)
        return out
    fields = getattr(obj, "__dataclass_fields__", None)
    if not fields:
        return out
    display_id = getattr(obj, "display_id", None)
    if isinstance(display_id, str) and display_id:
        u = clean_username(display_id)
        if u:
            room = None
            direct = getattr(obj, "room_id", None)  # PK katılımcı bilgisinde oda no doğrudan gelir
            if isinstance(direct, int) and direct > 0:
                room = direct
            own = getattr(obj, "own_room", None) if room is None else None
            if own is not None:
                ids = [int(x) for x in (getattr(own, "room_ids", None) or []) if x] or [
                    int(x) for x in (getattr(own, "room_ids_str", None) or []) if str(x).isdigit()
                ]
                room = ids[0] if ids else None
            if room or u not in out:
                out[u] = room
    for name in fields:
        v = getattr(obj, name, None)
        if v is None or isinstance(v, _SCALARS):
            continue
        extract_anchors(v, depth + 1, out)
    return out


_ROOM_RE = re.compile(r"room_id=(\d{6,})|/room/(\d{6,})|[?&]id=(\d{15,})")


def extract_notify_lead(event: Any) -> Optional[Tuple[int, int]]:
    """Oda bildiriminden (yayıncı kimliği, oda no) çıkarır. Bildirimdeki 'user' hediye gönderen izleyicidir, yayıncı değil."""
    notify = getattr(event, "notify", None) or event
    anchor = getattr(notify, "to_anchor_id", 0) or 0
    schema = str(getattr(notify, "schema", "") or "")
    m = _ROOM_RE.search(schema)
    room = int(next(g for g in m.groups() if g)) if m else 0
    if anchor and room:
        return int(anchor), room
    return None


def _room_of(v: Any) -> Optional[int]:
    v = str(v or "")
    return int(v) if v.isdigit() and v != "0" and len(v) >= 6 else None


def extract_from_json(obj: Any, out: Optional[Dict[str, Optional[int]]] = None, depth: int = 0) -> Dict[str, Optional[int]]:
    """TikTok'un JSON verilerinden (oda listeleri, sayfa durumu) canlı yayıncı ve oda numarası toplar."""
    if out is None:
        out = {}
    if depth > 14:
        return out
    if isinstance(obj, list):
        for x in obj:
            extract_from_json(x, out, depth + 1)
    elif isinstance(obj, dict):
        # Oda nesnesi: { id_str/roomId, owner: { display_id/uniqueId } }
        owner = obj.get("owner") or obj.get("anchor")
        if isinstance(owner, dict):
            name = clean_username(owner.get("display_id") or owner.get("uniqueId") or owner.get("unique_id"))
            room = _room_of(obj.get("id_str") or obj.get("roomId") or obj.get("room_id") or obj.get("id")) or _room_of(
                owner.get("roomId") or owner.get("room_id")
            )
            if name and room:
                out[name] = room
        # Kullanıcı nesnesi: canlıyken roomId taşır
        name = clean_username(obj.get("uniqueId") or obj.get("display_id") or "")
        if name:
            room = _room_of(obj.get("roomId") or obj.get("room_id"))
            own = obj.get("own_room")
            if not room and isinstance(own, dict):
                ids = own.get("room_ids_str") or own.get("room_ids") or []
                room = _room_of(ids[0]) if ids else None
            if room:
                out[name] = room
        for v in obj.values():
            if isinstance(v, (dict, list)):
                extract_from_json(v, out, depth + 1)
    return out


_SCRIPT_JSON_RE = re.compile(r'<script[^>]*type="application/json"[^>]*>(.*?)</script>', re.S)


def extract_from_html(html: str) -> Dict[str, Optional[int]]:
    out: Dict[str, Optional[int]] = {}
    for block in _SCRIPT_JSON_RE.findall(html or ""):
        try:
            extract_from_json(json.loads(block), out)
        except ValueError:
            continue
    return out


# ----------------------------------------------------------------------------
# Sandık durumu
# ----------------------------------------------------------------------------


@dataclass
class Chest:
    id: str
    coins: int
    people: int
    unpack_at: int
    sender: str


@dataclass
class StreamState:
    username: str
    chests: Dict[str, Chest] = field(default_factory=dict)
    seen: Set[str] = field(default_factory=set)
    viewers: Optional[int] = None
    title: str = ""
    reported: bool = False
    last_report_key: Optional[tuple] = None
    last_report_at: float = 0.0
    last_chest_at: float = 0.0
    coins_seen: int = 0

    def add_chest(self, c: Chest, now: float) -> bool:
        new = c.id not in self.seen
        self.chests[c.id] = c
        self.seen.add(c.id)
        self.last_chest_at = now
        if new:
            self.coins_seen += c.coins
        return new

    def remove_chest(self, cid: str) -> None:
        self.chests.pop(cid, None)

    def prune(self, now: float, grace: int = 45) -> None:
        for cid in [cid for cid, c in self.chests.items() if c.unpack_at and c.unpack_at + grace < now]:
            del self.chests[cid]

    def payload(self, now: float) -> dict:
        active = list(self.chests.values())
        coins = sum(c.coins for c in active)
        upcoming = [c.unpack_at for c in active if c.unpack_at and c.unpack_at > now]
        title = f"{len(active)} sandık, toplam {coins_text(coins)} jeton" if active else self.title[:120]
        return {
            "username": self.username,
            "coins": coins,
            "chests": len(active),
            "nextChestAt": min(upcoming) if upcoming else None,
            "viewers": self.viewers,
            "title": title,
            "url": f"https://www.tiktok.com/@{self.username}/live",
        }


# ----------------------------------------------------------------------------
# Tek bir yayına bağlantı
# ----------------------------------------------------------------------------


class Session:
    """Bir canlı yayına açık bağlantı. mode: 'probe' (yoklama), 'hold' (sandıklı, tutuluyor), 'pinned' (listede)."""

    def __init__(self, bot: "Bot", username: str, room_id: Optional[int], mode: str):
        self.bot = bot
        self.username = username
        self.room_id = room_id
        self.mode = mode
        self.state = StreamState(username)
        self.client: Any = None
        self.task: Optional[asyncio.Task] = None
        self.opened_at = time.time()
        self.connected = False
        self.closing = False
        self.live_ended = False
        self._report_soon: Optional[asyncio.Task] = None
        self._discovery_at: Dict[str, float] = {}

    async def open(self) -> None:
        from TikTokLive import TikTokLiveClient
        from TikTokLive import events as ev

        client = TikTokLiveClient(unique_id=f"@{self.username}", **self.bot.client_kwargs())
        apply_region(client.web, self.bot.cfg.region)
        self.client = client

        async def on_connect(_: Any) -> None:
            self.connected = True
            if self.mode != "probe":
                log.info(f"{C['cyan']}@{self.username}{C['reset']} yayınına bağlanıldı")

        async def on_envelope(event: Any) -> None:
            self.handle_envelope(event)

        async def on_viewers(event: Any) -> None:
            try:
                self.state.viewers = int(event.total)
            except Exception:
                pass

        async def on_end(_: Any) -> None:
            self.live_ended = True
            await self.bot.close_session(self, "yayın bitti")

        async def on_disconnect(_: Any) -> None:
            self.connected = False

        client.add_listener(ev.ConnectEvent, on_connect)
        client.add_listener(ev.EnvelopeEvent, on_envelope)
        client.add_listener(ev.RoomUserSeqEvent, on_viewers)
        client.add_listener(ev.LiveEndEvent, on_end)
        client.add_listener(ev.DisconnectEvent, on_disconnect)

        if self.bot.cfg.discovery:
            for name, source in DISCOVERY_EVENTS.items():
                cls = getattr(ev, name, None)
                if cls is not None:
                    client.add_listener(cls, self._discovery_handler(name, source))
            for name in ("RoomNotifyEvent", "GiftBroadcastEvent"):
                cls = getattr(ev, name, None)
                if cls is not None:
                    client.add_listener(cls, self._notify_handler)

        self.task = await client.start(room_id=self.room_id or None, fetch_room_info=False)
        self.opened_at = time.time()
        self.task.add_done_callback(lambda _t: asyncio.ensure_future(self.bot.close_session(self, "bağlantı kapandı")))

    def _discovery_handler(self, name: str, source: str):
        async def handler(event: Any) -> None:
            now = time.time()
            # Aynı türden mesajı en fazla 3 sn'de bir işle
            if now - self._discovery_at.get(name, 0) < 3:
                return
            self._discovery_at[name] = now
            try:
                found = extract_anchors(event)
            except Exception as e:  # Beklenmedik mesaj yapısı keşfi durdurmasın
                log.debug(f"Keşif mesajı okunamadı ({name}): {e}")
                return
            found.pop(self.username, None)
            if found:
                self.bot.discovered(found, source, via=self.username)

        return handler

    async def _notify_handler(self, event: Any) -> None:
        try:
            lead = extract_notify_lead(event)
        except Exception:
            return
        if lead:
            self.bot.add_lead(*lead)

    def handle_envelope(self, event: Any) -> None:
        info = getattr(event, "envelope_info", None)
        if info is None:
            return
        now = time.time()
        cid = str(getattr(info, "envelope_id", "") or f"{info.unpack_at}-{info.diamond_count}")
        display = getattr(event, "display", None)
        if getattr(display, "name", str(display)) == "HIDE":
            self.state.remove_chest(cid)
        else:
            chest = Chest(
                id=cid,
                coins=int(info.diamond_count or 0),
                people=int(info.people_count or 0),
                unpack_at=int(info.unpack_at or 0),
                sender=str(info.send_user_name or ""),
            )
            if self.state.add_chest(chest, now):
                wait = max(0, chest.unpack_at - int(now))
                log.info(
                    f"{C['gold']}Sandık{C['reset']} @{self.username}: {C['gold']}{coins_text(chest.coins)} jeton{C['reset']}, "
                    f"{chest.people} kişi, {wait // 60} dk {wait % 60} sn sonra açılıyor"
                )
                if self.mode == "probe":
                    self.mode = "hold"  # arama yuvası anında bir sonraki yayına açılır
                    self.bot.on_hold(self)
        self.schedule_report()

    def schedule_report(self, delay: float = 2.0) -> None:
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
            return
        r = await self.bot.api.report(p)
        if not r:
            return
        self.state.last_report_key = key
        self.state.last_report_at = now
        if r.get("result") == "created":
            self.state.reported = True
            self.bot.counters["added"] += 1
            msg = "onaya gönderildi" if r.get("pending") else "siteye eklendi"
            log.info(f"{C['green']}@{self.username} {msg}{C['reset']} ({coins_text(p['coins'])} jeton, {p['chests']} sandık)")
        elif r.get("result") == "updated":
            self.state.reported = True
        elif r.get("result") == "skipped":
            log.info(f"@{self.username} eklenmedi: {r.get('reason', '')}")

    async def tick(self, now: float) -> Optional[str]:
        """Periyodik kontrol. Kapatılması gerekiyorsa sebebini döner."""
        self.state.prune(now)
        if self.state.reported:
            if self.state.chests and now - self.state.last_report_at > self.bot.cfg.keepalive_sec:
                await self.report(force=True)
            elif self.state.last_report_key and self.state.last_report_key[1] != len(self.state.chests):
                await self.report()
        if self.mode == "probe" and now - self.opened_at > self.bot.cfg.probe_seconds:
            return "sandık yok"
        if self.mode == "hold" and not self.state.chests and now - self.state.last_chest_at > self.bot.cfg.linger_minutes * 60:
            return "sandık kalmadı"
        return None

    async def disconnect(self) -> None:
        client, self.client = self.client, None
        if client:
            try:
                await client.disconnect()
            except Exception:
                pass


# ----------------------------------------------------------------------------
# Ana bot
# ----------------------------------------------------------------------------

FEED_URL = "https://webcast.tiktok.com/webcast/feed/"
LIVE_PAGE_URL = "https://www.tiktok.com/live?lang=tr-TR"


REGIONS = {
    "TR": ("tr", "tr-TR", "Europe/Istanbul"),
    "AZ": ("az", "az-AZ", "Asia/Baku"),
    "DE": ("de", "de-DE", "Europe/Berlin"),
    "US": ("en", "en-US", "America/New_York"),
    "GB": ("en", "en-GB", "Europe/London"),
}


def apply_region(web: Any, region: str) -> None:
    """TikTok'a Türkiye'den bağlanan bir kullanıcı gibi görün; canlı sayfası ve akış bölgeye göre yayın gösterir."""
    lang, lang_country, tz = REGIONS.get(region, ("tr", "tr-TR", "Europe/Istanbul"))
    try:
        web.params.update(
            {
                "app_language": lang,
                "browser_language": lang_country,
                "webcast_language": lang,
                "priority_region": region,
                "region": region,
                "tz_name": tz,
            }
        )
        web.headers["Accept-Language"] = f"{lang_country},{lang};q=0.9"
    except Exception:
        pass


class Bot:
    def __init__(self, cfg: Config):
        self.cfg = cfg
        self.api = SiteAPI(cfg)
        self.pool = Pool(BASE_DIR / cfg.data_file if not Path(cfg.data_file).is_absolute() else Path(cfg.data_file))
        self.sessions: Dict[str, Session] = {}
        self.starting: Set[str] = set()
        self.stopping = asyncio.Event()
        self._web_client: Any = None
        self._web_lock = asyncio.Semaphore(4)
        self.pinned: Set[str] = set()
        self.seeds: Set[str] = set(cfg.seed_usernames)
        self.counters = {"probed": 0, "added": 0, "discovered": 0, "checks": 0, "check_errors": 0}
        self.leads: Dict[int, int] = {}  # oda no -> yayıncı kimliği
        self.feed_disabled_until = 0.0
        self.feed_fails = 0
        self.tiktok_backoff_until = 0.0
        if cfg.sign_api_key:
            os.environ["SIGN_API_KEY"] = cfg.sign_api_key

    # -- TikTok yardımcıları --

    def client_kwargs(self) -> dict:
        return {"web_proxy": httpx.Proxy(self.cfg.proxy)} if self.cfg.proxy else {}

    def web(self) -> Any:
        if self._web_client is None:
            from TikTokLive import TikTokLiveClient

            self._web_client = TikTokLiveClient(unique_id="tiktok", **self.client_kwargs())
            apply_region(self._web_client.web, self.cfg.region)
        return self._web_client.web

    async def rooms_alive(self, room_ids: List[int]) -> List[bool]:
        async with self._web_lock:
            res = await self.web().fetch_is_live.fetch_is_live_room_ids(*room_ids)
            await asyncio.sleep(random.uniform(0.2, 0.6))
            return [bool(x) for x in res]

    async def user_live(self, username: str) -> Tuple[bool, Optional[int]]:
        """Kullanıcı adından canlılık ve oda numarası."""
        from TikTokLive.client.web.routes.fetch_room_id_api import FetchRoomIdAPIRoute

        async with self._web_lock:
            data = await FetchRoomIdAPIRoute.fetch_user_room_data(web=self.web(), unique_id=username)
            await asyncio.sleep(random.uniform(0.3, 0.8))
        d = data.get("data") or {}
        room = str((d.get("user") or {}).get("roomId") or "")
        status = (d.get("liveRoom") or {}).get("status")
        # TikTokLive kütüphanesiyle aynı kural: 4 = yayın kapalı
        live = status is not None and status != 4 and room.isdigit() and room != "0"
        return live, int(room) if live else None

    # -- Keşif --

    def discovered(self, found: Dict[str, Optional[int]], source: str, via: str = "") -> None:
        now = time.time()
        new = 0
        for u, room in found.items():
            if self.pool.add(u, room, source, live_now=room is not None, now=now):
                new += 1
        if new:
            self.counters["discovered"] += new
            log.debug(f"{new} yeni yayıncı keşfedildi ({source}{', @' + via if via else ''})")

    def add_lead(self, anchor_id: int, room_id: int) -> None:
        if len(self.leads) < 500:
            self.leads[room_id] = anchor_id

    async def process_leads(self, now: float) -> None:
        """Oda bildirimlerinden gelen ipuçlarını doğrula ve en öne al."""
        if not self.leads:
            return
        batch = list(self.leads.items())[:20]
        for room, _ in batch:
            self.leads.pop(room, None)
        try:
            alive = await self.rooms_alive([r for r, _ in batch])
        except Exception as e:
            log.debug(f"İpucu odaları kontrol edilemedi: {type(e).__name__}: {e}")
            return
        resolved = 0
        for (room, anchor), ok in zip(batch, alive):
            if not ok:
                continue
            name = self.pool.anchor_name(anchor)
            if not name and resolved < 3:
                try:
                    async with self._web_lock:
                        raw = await self.web().fetch_user_unique_id(anchor)
                        await asyncio.sleep(random.uniform(0.8, 1.6))
                    name = clean_username(raw)
                    resolved += 1
                    if name:
                        self.pool.save_anchor(anchor, name, now)
                except Exception as e:
                    log.debug(f"Yayıncı kimliği çözülemedi ({anchor}): {type(e).__name__}")
            if name:
                if self.pool.add(name, room, "bildirim", True, now):
                    self.counters["discovered"] += 1
                self.pool.mark_hot(name, now + 600, now)
        self.pool.commit()

    async def _try_live_page(self) -> Dict[str, Optional[int]]:
        async with self._web_lock:
            r = await self.web().get(url=LIVE_PAGE_URL, base_params=False)
        if r.status_code != 200:
            raise ValueError(f"HTTP {r.status_code}")
        return extract_from_html(r.text)

    async def _try_feed(self) -> Dict[str, Optional[int]]:
        async with self._web_lock:
            r = await self.web().get(
                url=FEED_URL,
                extra_params={"channel_id": "86", "content_type": "0", "req_from": "feed_loadmore", "max_time": "0"},
                sign_url=True,
            )
        if r.status_code != 200:
            raise ValueError(f"HTTP {r.status_code}")
        return extract_from_json(r.json())

    async def feed_discovery(self, loud: bool = False) -> int:
        """TikTok'un canlı yayınlar sayfasından ve akışından tohum yayıncı toplar. Bulunan sayıyı döner."""
        if not self.cfg.feed_discovery or time.time() < self.feed_disabled_until:
            return 0
        total = 0
        errors = []
        for label, fn in (("canlı yayınlar sayfası", self._try_live_page), ("canlı akış", self._try_feed)):
            try:
                found = await fn()
            except Exception as e:
                errors.append(f"{label}: {type(e).__name__} {str(e)[:120]}")
                continue
            if found:
                self.discovered(found, "akış")
                total += len(found)
                (log.info if loud else log.debug)(f"{label.capitalize()} üzerinden {len(found)} canlı yayın bulundu")
            else:
                errors.append(f"{label}: yayın verisi yok")
        self.pool.commit()
        if total:
            self.feed_fails = 0
            return total
        self.feed_fails += 1
        (log.warning if loud else log.debug)("Tohum bulunamadı. " + "; ".join(errors))
        if self.feed_fails >= 6:
            self.feed_disabled_until = time.time() + 3 * 3600
            self.feed_fails = 0
            log.info("TikTok sayfalarından tohum çekilemiyor; 3 saat sonra tekrar denenecek.")
        return 0

    # -- Oturumlar --

    async def start_session(self, username: str, room_id: Optional[int]) -> None:
        mode = "pinned" if username in self.pinned else "probe"
        s = Session(self, username, room_id, mode)
        self.starting.add(username)
        try:
            await s.open()
            self.sessions[username] = s
            self.counters["probed"] += 1
            log.debug(f"@{username} yoklanıyor ({len(self.sessions)}/{self.cfg.max_connections})")
        except Exception as e:
            from TikTokLive.client.errors import UserOfflineError

            await s.disconnect()
            now = time.time()
            if isinstance(e, UserOfflineError):
                self.pool.mark_offline(username, now, self.cfg)
            else:
                name = type(e).__name__
                log.debug(f"@{username} yayınına bağlanılamadı: {name}: {e}")
                self.pool.schedule(username, now + 600)
                self._note_tiktok_error(name, str(e))
        finally:
            self.starting.discard(username)

    def on_hold(self, s: "Session") -> None:
        holding = [x for x in self.sessions.values() if x.mode == "hold" and x is not s]
        if len(holding) < self.cfg.max_hold:
            return
        # Tutma kapasitesi dolu: açık sandığı kalmamış en eski yayını bırak
        idle = sorted((x for x in holding if not x.state.chests), key=lambda x: x.state.last_chest_at)
        if idle:
            asyncio.ensure_future(self.close_session(idle[0], "yer açmak için bırakıldı"))

    def _note_tiktok_error(self, name: str, msg: str) -> None:
        text = f"{name} {msg}".lower()
        if any(k in text for k in ("rate", "429", "limit", "captcha", "sign")):
            self.tiktok_backoff_until = time.time() + 120
            log.warning(f"TikTok/imza servisi istekleri sınırlıyor ({name}). 2 dk yavaşlanıyor.")

    async def close_session(self, s: Session, reason: str) -> None:
        if s.closing:
            return
        s.closing = True
        self.sessions.pop(s.username, None)
        now = time.time()
        saw = bool(s.state.seen)
        if s.live_ended:
            self.pool.mark_offline(s.username, now, self.cfg)
        else:
            self.pool.mark_probe(s.username, now, saw, s.state.coins_seen, self.cfg)
            if reason == "bağlantı kapandı" and (s.state.chests or s.mode == "pinned"):
                self.pool.schedule(s.username, now + 15)  # Sandık varken koptu: hemen tekrar bağlan
        self.pool.commit()
        if s.state.reported and (s.live_ended or reason == "kapanış"):
            await self.api.end(s.username)
            log.info(f"@{s.username} siteden kaldırıldı ({reason})")
        elif saw and reason != "bağlantı kapandı":
            log.info(f"@{s.username} bırakıldı ({reason})")
        await s.disconnect()

    # -- Döngüler --

    async def scheduler_loop(self) -> None:
        while not self.stopping.is_set():
            try:
                await self._schedule_once()
            except Exception as e:
                log.warning(f"Zamanlayıcı hatası: {type(e).__name__}: {e}")
            await self._sleep(2)

    async def _schedule_once(self) -> None:
        now = time.time()
        for s in list(self.sessions.values()):
            reason = await s.tick(now)
            if reason:
                await self.close_session(s, reason)

        if now < self.tiktok_backoff_until:
            return
        if self.cfg.discovery:
            await self.process_leads(now)
        probing = sum(1 for s in self.sessions.values() if s.mode == "probe")
        free = self.cfg.max_connections - probing - len(self.starting)
        if free <= 0:
            return

        busy = set(self.sessions) | self.starting
        cands = self.pool.candidates(now, busy, limit=min(250, free * 4))
        if len(cands) < free * 2:
            # Sırası gelen az: boşta kalma, en uzun süredir bakılmayanlarla devam et
            seen = busy | {r["username"] for r in cands}
            cands += self.pool.backlog(now, seen, limit=free * 2 - len(cands))
        if not cands:
            return

        with_room = [r for r in cands if r["room_id"]]
        without = [r for r in cands if not r["room_id"]]
        live: List[Tuple[str, Optional[int]]] = []

        # Oda numarası bilinenleri toplu doğrula
        for i in range(0, len(with_room), 50):
            chunk = with_room[i : i + 50]
            try:
                alive = await self.rooms_alive([int(r["room_id"]) for r in chunk])
                self.counters["checks"] += 1
            except Exception as e:
                self.counters["check_errors"] += 1
                log.debug(f"Toplu canlı kontrolü başarısız: {type(e).__name__}: {e}")
                self._note_tiktok_error(type(e).__name__, str(e))
                for r in chunk:
                    self.pool.schedule(r["username"], now + 300)
                break
            for r, ok in zip(chunk, alive):
                if ok:
                    live.append((r["username"], int(r["room_id"])))
                else:
                    self.pool.mark_offline(r["username"], now, self.cfg)

        # Oda numarası bilinmeyenleri paralel kontrol et
        async def check_user(r: sqlite3.Row) -> None:
            try:
                ok, room = await self.user_live(r["username"])
                self.counters["checks"] += 1
            except Exception as e:
                self.counters["check_errors"] += 1
                msg = str(e).lower()
                if "not_found" in msg or "notfound" in type(e).__name__.lower():
                    self.pool.schedule(r["username"], now + 7 * 86400)
                else:
                    self.pool.schedule(r["username"], now + 900)
                    self._note_tiktok_error(type(e).__name__, str(e))
                return
            if ok:
                self.pool.add(r["username"], room, r["source"] or "liste", True, now)
                live.append((r["username"], room))
            else:
                self.pool.mark_offline(r["username"], now, self.cfg)

        await asyncio.gather(*(check_user(r) for r in without[:8]))
        for r in without[8:]:
            self.pool.schedule(r["username"], now + random.uniform(30, 120))
        self.pool.commit()

        todo = live[:free]
        for username, _ in todo:
            self.pool.schedule(username, now + 3600)  # Bağlıyken tekrar seçilmesin
        step = self.cfg.parallel_starts
        for i in range(0, len(todo), step):
            if self.stopping.is_set():
                break
            await asyncio.gather(*(self.start_session(u, room) for u, room in todo[i : i + step]))
            await asyncio.sleep(self.cfg.start_interval_sec)
        for username, _ in live[free:]:
            self.pool.schedule(username, now + 20)  # Yer açılınca öncelikli
        self.pool.commit()

    async def heartbeat_loop(self) -> None:
        first = True
        while not self.stopping.is_set():
            cfg = await self.api.heartbeat(self.status())
            if cfg is not None:
                self.pinned = {u for u in map(clean_username, cfg.get("watchlist", [])) if u}
                self.pool.set_pinned(self.pinned, time.time())
                known = {u for u in map(clean_username, cfg.get("knownUsernames", [])) if u}
                seeds = (known | self.seeds) - self.pinned
                if seeds:
                    self.discovered({u: None for u in seeds}, "tohum")
                    self.pool.commit()
                if first:
                    log.info(
                        f"Siteye bağlanıldı. İzleme listesi: {len(self.pinned)} hesap, tohum: {len(seeds)} hesap, "
                        f"keşif havuzu: {self.pool.stats(time.time())['pool']} hesap"
                    )
                first = False
            elif first:
                log.error("Siteden ayarlar alınamadı. site_url ve api_key değerlerini kontrol et.")
            await self._sleep(self.cfg.heartbeat_sec)

    async def discovery_loop(self) -> None:
        await self._sleep(2)  # Önce siteden tohumlar gelsin
        warned = False
        while not self.stopping.is_set():
            pool_size = self.pool.stats(time.time())["pool"]
            wait = 120 if pool_size < 300 else 600
            if self.cfg.discovery:
                empty = not self.sessions and pool_size == 0
                found = await self.feed_discovery(loud=empty)
                removed = self.pool.prune(self.cfg.pool_max, time.time())
                if removed:
                    log.debug(f"Havuzdan {removed} eski hesap silindi")
                self.pool.commit()
                if empty and not found:
                    wait = 60
                    if not warned:
                        warned = True
                        log.warning(
                            "Keşif havuzu boş, bot dakikada bir tohum aramaya devam edecek. Hızlandırmak için admin panelinde "
                            "Otomasyon > Öncelikli hesaplar'a şu an canlı olan 1-2 TikTok hesabı yaz; bot oradan kendisi yayılır."
                        )
            await self._sleep(wait)

    async def status_loop(self) -> None:
        while not self.stopping.is_set():
            await self._sleep(300)
            st = self.status()
            log.info(
                f"{C['dim']}Durum: havuz {st['pool']} hesap ({st['discoveredToday']} bugün), "
                f"{st['probing']} yayın aranıyor, {st['holding']} sandıklı yayın takipte, "
                f"bu oturumda {self.counters['probed']} yayın yoklandı, {self.counters['added']} siteye eklendi{C['reset']}"
            )

    def status(self) -> dict:
        st = self.pool.stats(time.time())
        holding = sum(1 for s in self.sessions.values() if s.mode == "hold")
        return {
            "watching": st["pool"],
            "live": len(self.sessions),
            "connected": sum(1 for s in self.sessions.values() if s.connected),
            "pool": st["pool"],
            "probing": sum(1 for s in self.sessions.values() if s.mode == "probe"),
            "holding": holding,
            "chestAccounts": st["withChests"],
            "discoveredToday": st["discoveredToday"],
            "discovery": self.cfg.discovery,
        }

    async def _sleep(self, sec: float) -> None:
        try:
            await asyncio.wait_for(self.stopping.wait(), timeout=sec)
        except asyncio.TimeoutError:
            pass

    async def run(self) -> None:
        log.info(f"{C['gold']}Tiktok Jetonlu Yayın Bulma botu {VERSION}{C['reset']} başlıyor, site: {self.cfg.site_url}")
        log.info(
            f"Keşif {'açık' if self.cfg.discovery else 'kapalı'}, bölge {self.cfg.region}, aynı anda {self.cfg.max_connections} yayın aranır "
            f"(+{self.cfg.max_hold} sandıklı yayın takibi), her yayına {self.cfg.probe_seconds} sn bakılır"
        )
        loops = [
            asyncio.ensure_future(self.heartbeat_loop()),
            asyncio.ensure_future(self.scheduler_loop()),
            asyncio.ensure_future(self.discovery_loop()),
            asyncio.ensure_future(self.status_loop()),
        ]
        await self.stopping.wait()
        log.info("Kapatılıyor, açık yayınlar siteden kaldırılıyor...")
        for s in list(self.sessions.values()):
            await self.close_session(s, "kapanış")
        for t in loops:
            t.cancel()
        self.pool.commit()
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
    log.info(
        f"İzleme listesi: {len(conf.get('watchlist', []))} hesap, sitedeki bilinen yayıncılar: {len(conf.get('knownUsernames', []))}. "
        f"Onaysız yayınla: {'açık' if conf.get('autoPublish') else 'kapalı'}"
    )
    return 0


async def cmd_check(cfg: Config, username: str) -> int:
    bot = Bot(cfg)
    u = clean_username(username)
    log.info(f"@{u} kontrol ediliyor...")
    try:
        live, room = await bot.user_live(u)
    except Exception as e:
        log.error(f"Kontrol edilemedi: {type(e).__name__}: {e}")
        return 1
    finally:
        await bot.api.close()
    log.info(f"@{u} şu an {'canlı (oda ' + str(room) + ')' if live else 'canlı değil'}")
    return 0


def cmd_stats(cfg: Config) -> int:
    path = BASE_DIR / cfg.data_file if not Path(cfg.data_file).is_absolute() else Path(cfg.data_file)
    if not path.exists():
        log.info("Henüz keşif verisi yok.")
        return 0
    pool = Pool(path)
    st = pool.stats(time.time())
    log.info(
        f"Havuz: {st['pool']} hesap, son 24 saatte {st['discoveredToday']} yeni, "
        f"son 30 dk'da canlı görülen {st['liveRecently']}, sandık görülen {st['withChests']}"
    )
    for r in pool.top():
        log.info(f"  @{r['username']:<24} {r['chest_hits']:>4} sandıklı yoklama, toplam {coins_text(r['coins_total'])} jeton")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="Tiktok Jetonlu Yayın Bulma botu")
    ap.add_argument("--config", default=str(BASE_DIR / "config.json"), help="Ayar dosyası (varsayılan: config.json)")
    ap.add_argument("--test", action="store_true", help="Site bağlantısını ve API anahtarını dene")
    ap.add_argument("--check", metavar="KULLANICI", help="Tek bir hesabın canlı olup olmadığını dene")
    ap.add_argument("--stats", action="store_true", help="Keşif havuzunun özetini göster")
    ap.add_argument("-v", "--verbose", action="store_true", help="Ayrıntılı kayıt")
    args = ap.parse_args()

    setup_logging(args.verbose)
    cfg_path = Path(args.config)
    if not cfg_path.exists() and not os.environ.get("TJ_API_KEY"):
        log.error(f"{cfg_path.name} bulunamadı. config.example.json dosyasını {cfg_path.name} adıyla kopyalayıp doldur.")
        return 1
    cfg = Config.load(cfg_path)
    if args.stats:
        return cmd_stats(cfg)
    err = cfg.validate()
    if err:
        log.error(err)
        return 1
    if args.test:
        return asyncio.run(cmd_test(cfg))
    if args.check:
        return asyncio.run(cmd_check(cfg, args.check))

    setup_logging(args.verbose, cfg.log_file)

    async def runner() -> None:
        bot = Bot(cfg)
        loop = asyncio.get_running_loop()
        for sig in (signal.SIGINT, signal.SIGTERM):
            try:
                loop.add_signal_handler(sig, bot.stopping.set)
            except (NotImplementedError, RuntimeError):
                pass
        await bot.run()

    try:
        asyncio.run(runner())
    except KeyboardInterrupt:
        log.info("Durduruldu.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
