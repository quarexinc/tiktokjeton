import { NextResponse } from "next/server";
import { clientIp, MEMBER_COOKIE, memberCookieMaxAge, memberCookieValue } from "@/lib/auth";
import { addLog, addLoginStat, getKey, rateLimit, saveKey } from "@/lib/store";
import { formatCode, loginBlockReason } from "@/lib/keys";
import { fail, safe } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return safe(async () => {
    const ip = await clientIp();
    if (!(await rateLimit("member", ip, 12, 600))) {
      return fail("Çok fazla deneme yapıldı. 10 dakika sonra tekrar dene.", 429);
    }
    const body = await req.json().catch(() => ({}));
    const input = typeof body?.code === "string" ? body.code : "";
    if (input.replace(/[^A-Za-z0-9]/g, "").length < 6) return fail("Anahtarı eksiksiz gir.");

    const k = await getKey(input);
    if (!k) {
      await addLog("member_fail", `Geçersiz anahtar denendi: ${formatCode(input).slice(0, 19)}`);
      await new Promise((r) => setTimeout(r, 600));
      return fail("Bu anahtar bulunamadı. Harfleri kontrol edip tekrar dene.", 401);
    }

    const now = Date.now();
    const reason = loginBlockReason(k, now);
    if (reason) {
      await addLog("member_fail", `${k.code} ile giriş engellendi: ${reason}`);
      return fail(reason, 403);
    }

    const iso = new Date(now).toISOString();
    k.uses += 1;
    k.lastUsedAt = iso;
    if (!k.activatedAt) {
      k.activatedAt = iso;
      if (k.startMode === "first-use" && k.durationDays !== null) {
        k.expiresAt = new Date(now + k.durationDays * 86400_000).toISOString();
      }
    }
    await saveKey(k);
    await Promise.all([
      addLoginStat(),
      addLog("member_login", `${k.code}${k.label ? ` (${k.label})` : ""} giriş yaptı`),
    ]);

    const res = NextResponse.json({ ok: true });
    res.cookies.set(MEMBER_COOKIE, memberCookieValue(k), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: memberCookieMaxAge(k),
    });
    return res;
  });
}
