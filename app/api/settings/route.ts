import { NextResponse } from "next/server";
import { safe } from "@/lib/http";
import { isAdmin } from "@/lib/auth";
import { mutateDB, readDB } from "@/lib/store";
import { parseSettings } from "@/lib/validate";

export const dynamic = "force-dynamic";

export async function PUT(req: Request) {
  return safe(async () => {
  if (!(await isAdmin())) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const current = await readDB();
  const parsed = parseSettings(body, current.settings);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const db = await mutateDB((db) => {
    db.settings = parsed.value;
  });
  return NextResponse.json({ ...db, now: Date.now() });
  });
}
