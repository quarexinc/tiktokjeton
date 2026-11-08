import { NextResponse } from "next/server";
import { adminKeyConfigured, checkKey, clientIp, COOKIE_MAX_AGE, COOKIE_NAME, newSessionValue } from "@/lib/auth";
import { addLog, rateLimit } from "@/lib/store";
import { fail, safe } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return safe(async () => {
    if (!adminKeyConfigured()) {
      return fail("Sunucuda ADMIN_KEY tanımlı değil. Vercel ortam değişkenlerine ekleyip yeniden yayınla.", 503);
    }
    const ip = await clientIp();
    if (!(await rateLimit("admin", ip, 8, 900))) {
      return fail("Çok fazla deneme yapıldı. 15 dakika sonra tekrar dene.", 429);
    }
    const body = await req.json().catch(() => ({}));
    const key = typeof body?.key === "string" ? body.key : "";

    if (!checkKey(key)) {
      await addLog("admin_fail", "Admin paneline hatalı anahtarla giriş denendi");
      await new Promise((r) => setTimeout(r, 800));
      return fail("Anahtar yanlış.", 401);
    }

    await addLog("admin_login", "Admin paneline giriş yapıldı");
    const res = NextResponse.json({ ok: true });
    res.cookies.set(COOKIE_NAME, newSessionValue(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: COOKIE_MAX_AGE,
    });
    return res;
  });
}
