import { addLog, getKey, listKeys, saveKey } from "@/lib/store";
import { generateCode } from "@/lib/keys";
import { parseKeyInput } from "@/lib/validate";
import { adminRoute, fail, json } from "@/lib/http";
import type { MemberKey } from "@/lib/types";

export const dynamic = "force-dynamic";

export const GET = adminRoute(async () => json({ keys: await listKeys(), now: Date.now() }));

export const POST = adminRoute(async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  const parsed = parseKeyInput(body);
  if (!parsed.ok) return fail(parsed.error);
  const { count, label, maxUses, durationDays, startMode } = parsed.value;

  const now = Date.now();
  const created: MemberKey[] = [];
  for (let i = 0; i < count; i++) {
    let code = generateCode();
    while (await getKey(code)) code = generateCode();
    const k: MemberKey = {
      code,
      label: count > 1 && label ? `${label} #${i + 1}` : label,
      maxUses,
      uses: 0,
      durationDays,
      startMode,
      expiresAt: startMode === "created" && durationDays !== null ? new Date(now + durationDays * 86400_000).toISOString() : null,
      activatedAt: null,
      lastUsedAt: null,
      disabled: false,
      sessionVersion: 1,
      createdAt: new Date(now + i).toISOString(),
    };
    await saveKey(k);
    created.push(k);
  }
  await addLog("key_created", `${count} anahtar oluşturuldu${label ? ` (${label})` : ""}`);
  return json({ created, keys: await listKeys(), now: Date.now() });
});
