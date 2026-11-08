import { NextResponse } from "next/server";
import { getAccess } from "@/lib/auth";
import { addClick, readDB } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Yayına yönlendirir ve tıklamayı sayar */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const home = new URL("/", req.url);
  try {
    const access = await getAccess();
    if (!access.allowed) return NextResponse.redirect(home, 303);
    const db = await readDB();
    const s = db.streams.find((x) => x.id === id);
    if (!s) return NextResponse.redirect(home, 303);
    if (!access.admin) await addClick(s.id);
    return NextResponse.redirect(s.url, 302);
  } catch (e) {
    console.error(e);
    return NextResponse.redirect(home, 303);
  }
}
