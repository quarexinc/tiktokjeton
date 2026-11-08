import "server-only";
import { NextResponse } from "next/server";
import { isAdmin } from "./auth";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export function fail(error: string, status = 400) {
  return json({ error }, status);
}

/** Route içindeki beklenmeyen hataları okunur bir mesaja çevirir. */
export async function safe(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    console.error(e);
    if (e instanceof Error && e.name === "StorageMissingError") return fail(e.message, 503);
    return fail("İşlem yapılamadı: depolamaya ulaşılamadı. Vercel'deki depolama bağlantısını kontrol et.", 503);
  }
}

/** Sadece admin oturumu ile çalışan route sarmalayıcı */
export function adminRoute<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return (...args: A) =>
    safe(async () => {
      if (!(await isAdmin())) return fail("Giriş gerekli.", 401);
      return fn(...args);
    });
}
