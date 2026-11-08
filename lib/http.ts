import "server-only";
import { NextResponse } from "next/server";

/** Route içindeki beklenmeyen hataları okunur bir mesaja çevirir. */
export async function safe(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error && e.name === "Error" && e.message.startsWith("Depolama")
      ? e.message
      : "Kayıt yapılamadı: depolamaya ulaşılamadı. Vercel'de depolama bağlantısını kontrol et.";
    return NextResponse.json({ error: msg }, { status: 503 });
  }
}
