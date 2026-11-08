import { addLog, getClicks, mutateDB, readDB } from "@/lib/store";
import { parseSettings } from "@/lib/validate";
import { adminRoute, fail, json } from "@/lib/http";

export const dynamic = "force-dynamic";

export const PUT = adminRoute(async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  const current = await readDB();
  const parsed = parseSettings(body, current.settings);
  if (!parsed.ok) return fail(parsed.error);
  const db = await mutateDB((db) => {
    db.settings = parsed.value;
  });
  await addLog("settings", "Site ayarları güncellendi");
  return json({ ...db, clicks: await getClicks(), now: Date.now() });
});
