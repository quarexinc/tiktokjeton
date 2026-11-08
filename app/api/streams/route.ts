import { randomUUID } from "crypto";
import { getAccess, isAdmin } from "@/lib/auth";
import { addLog, getClicks, mutateDB, readDB } from "@/lib/store";
import { getPublicPayload } from "@/lib/public";
import { parseStreamInput } from "@/lib/validate";
import { adminRoute, fail, json, safe } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Ana sayfa yenilemesi (üye ya da admin). ?all=1 ile admin tüm veriyi ve tıklamaları alır. */
export async function GET(req: Request) {
  return safe(async () => {
    if (new URL(req.url).searchParams.get("all") === "1") {
      if (!(await isAdmin())) return fail("Giriş gerekli.", 401);
      const [db, clicks] = await Promise.all([readDB(), getClicks()]);
      return json({ ...db, clicks, now: Date.now() });
    }
    const access = await getAccess();
    if (!access.allowed) return fail("Giriş gerekli.", 401);
    return json(await getPublicPayload());
  });
}

export const POST = adminRoute(async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  const parsed = parseStreamInput(body);
  if (!parsed.ok) return fail(parsed.error);

  const db = await mutateDB((db) => {
    db.streams.push({ ...parsed.value, id: randomUUID(), endedAt: null, createdAt: new Date().toISOString() });
  });
  await addLog("stream_added", `@${parsed.value.username} yayını eklendi`);
  return json({ ...db, clicks: await getClicks(), now: Date.now() });
});
