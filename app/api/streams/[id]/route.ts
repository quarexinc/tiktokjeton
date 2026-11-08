import { NextResponse } from "next/server";
import { safe } from "@/lib/http";
import { isAdmin } from "@/lib/auth";
import { mutateDB, readDB } from "@/lib/store";
import { parseStreamInput } from "@/lib/validate";
import { endTime } from "@/lib/status";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Gövde:
 *  - { action: "end" }            yayını hemen geçmişe taşır
 *  - { action: "extend", minutes } süreyi uzatır (bitmişse şimdiden itibaren)
 *  - { action: "reopen" }          elle bitirilmiş yayını geri açar
 *  - diğer alanlar                  düzenleme
 */
export async function PATCH(req: Request, { params }: Ctx) {
  return safe(async () => {
  if (!(await isAdmin())) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const current = await readDB();
  const stream = current.streams.find((s) => s.id === id);
  if (!stream) return NextResponse.json({ error: "Yayın bulunamadı." }, { status: 404 });

  const now = Date.now();
  let error: string | null = null;

  const db = await mutateDB((db) => {
    const s = db.streams.find((x) => x.id === id);
    if (!s) return;

    if (body.action === "end") {
      s.endedAt = new Date(now).toISOString();
      return;
    }
    if (body.action === "reopen") {
      s.endedAt = null;
      return;
    }
    if (body.action === "extend") {
      const minutes = Math.round(Number(body.minutes));
      if (!Number.isFinite(minutes) || minutes < 1 || minutes > 60 * 24 * 7) {
        error = "Uzatma süresi 1 dakika ile 7 gün arasında olmalı.";
        return;
      }
      const start = new Date(s.startsAt).getTime();
      const end = endTime(s);
      const base = Math.max(end, now);
      s.endedAt = null;
      s.durationMin = Math.ceil((base + minutes * 60_000 - start) / 60_000);
      return;
    }

    const parsed = parseStreamInput(body, s);
    if (!parsed.ok) {
      error = parsed.error;
      return;
    }
    Object.assign(s, parsed.value);
  });

  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json({ ...db, now: Date.now() });
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  return safe(async () => {
  if (!(await isAdmin())) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  const { id } = await params;
  const db = await mutateDB((db) => {
    db.streams = db.streams.filter((s) => s.id !== id);
  });
  return NextResponse.json({ ...db, now: Date.now() });
  });
}
