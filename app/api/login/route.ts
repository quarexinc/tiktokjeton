import { NextResponse } from "next/server";
import { adminKeyConfigured, checkKey, COOKIE_MAX_AGE, COOKIE_NAME, newSessionValue } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!adminKeyConfigured()) {
    return NextResponse.json(
      { error: "Sunucuda ADMIN_KEY tanımlı değil. Vercel ortam değişkenlerine ekleyip yeniden yayınla." },
      { status: 503 }
    );
  }
  let key = "";
  try {
    const body = await req.json();
    key = typeof body?.key === "string" ? body.key : "";
  } catch {}

  if (!checkKey(key)) {
    // Deneme yanılmayı yavaşlatmak için küçük bekleme
    await new Promise((r) => setTimeout(r, 800));
    return NextResponse.json({ error: "Anahtar yanlış." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, newSessionValue(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  return res;
}
