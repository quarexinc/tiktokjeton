import { NextResponse } from "next/server";
import { safe } from "@/lib/http";
import { randomUUID } from "crypto";
import { isAdmin } from "@/lib/auth";
import { mutateDB, readDB } from "@/lib/store";
import { getPublicPayload } from "@/lib/public";
import { parseStreamInput } from "@/lib/validate";

export const dynamic = "force-dynamic";

/** Herkese açık: ana sayfanın yenilenmesi için. ?all=1 ile admin tüm veriyi alır. */
export async function GET(req: Request) {
  return safe(async () => {
  const all = new URL(req.url).searchParams.get("all") === "1";
  if (all) {
    if (!(await isAdmin())) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
    const db = await readDB();
    return NextResponse.json({ ...db, now: Date.now() }, { headers: { "Cache-Control": "no-store" } });
  }
  const payload = await getPublicPayload();
  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
  });
}

export async function POST(req: Request) {
  return safe(async () => {
  if (!(await isAdmin())) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const parsed = parseStreamInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const db = await mutateDB((db) => {
    db.streams.push({
      ...parsed.value,
      id: randomUUID(),
      endedAt: null,
      createdAt: new Date().toISOString(),
    });
  });
  return NextResponse.json({ ...db, now: Date.now() });
  });
}
