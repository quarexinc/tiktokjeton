import { addLog, deleteKey, getKey, listKeys, saveKey } from "@/lib/store";
import { adminRoute, fail, json } from "@/lib/http";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ code: string }> };

/**
 * Gövde (action):
 *  - disable / enable
 *  - extend { days }        süreyi uzatır (bitmişse şimdiden itibaren)
 *  - addUses { count }      giriş hakkı ekler
 *  - resetUses              kullanım sayısını sıfırlar
 *  - revoke                 açık oturumları kapatır
 *  - edit { label, maxUses, durationDays }
 */
export const PATCH = adminRoute(async (req: Request, { params }: Ctx) => {
  const { code } = await params;
  const k = await getKey(decodeURIComponent(code));
  if (!k) return fail("Anahtar bulunamadı.", 404);
  const body = await req.json().catch(() => ({}));
  const now = Date.now();
  let msg = "";

  switch (body.action) {
    case "disable":
      k.disabled = true;
      k.sessionVersion++;
      msg = "devre dışı bırakıldı";
      break;
    case "enable":
      k.disabled = false;
      msg = "etkinleştirildi";
      break;
    case "extend": {
      const days = Number(body.days);
      if (!Number.isFinite(days) || days <= 0 || days > 3650) return fail("Uzatma 1 ile 3650 gün arasında olmalı.");
      if (k.expiresAt) {
        const base = Math.max(new Date(k.expiresAt).getTime(), now);
        k.expiresAt = new Date(base + days * 86400_000).toISOString();
      } else if (k.durationDays !== null) {
        k.durationDays += days;
      }
      msg = `${days} gün uzatıldı`;
      break;
    }
    case "addUses": {
      const n = Math.round(Number(body.count));
      if (!Number.isFinite(n) || n < 1 || n > 100000) return fail("Eklenecek hak 1 ile 100.000 arasında olmalı.");
      if (k.maxUses !== null) k.maxUses += n;
      msg = `${n} giriş hakkı eklendi`;
      break;
    }
    case "resetUses":
      k.uses = 0;
      msg = "kullanım sayısı sıfırlandı";
      break;
    case "revoke":
      k.sessionVersion++;
      msg = "açık oturumları kapatıldı";
      break;
    case "edit": {
      if (typeof body.label === "string") k.label = body.label.trim().slice(0, 60);
      if (body.maxUses !== undefined) {
        if (body.maxUses === null || body.maxUses === "") k.maxUses = null;
        else {
          const n = Math.round(Number(body.maxUses));
          if (!Number.isFinite(n) || n < 1) return fail("Giriş hakkı en az 1 olmalı.");
          k.maxUses = n;
        }
      }
      if (body.expiresAt !== undefined) {
        if (body.expiresAt === null || body.expiresAt === "") {
          k.expiresAt = null;
          k.durationDays = null;
        } else {
          const d = new Date(String(body.expiresAt));
          if (isNaN(d.getTime())) return fail("Bitiş tarihi okunamadı.");
          k.expiresAt = d.toISOString();
        }
      }
      msg = "düzenlendi";
      break;
    }
    default:
      return fail("Bilinmeyen işlem.");
  }

  await saveKey(k);
  await addLog("key_updated", `${k.code} ${msg}`);
  return json({ key: k, keys: await listKeys(), now: Date.now() });
});

export const DELETE = adminRoute(async (_req: Request, { params }: Ctx) => {
  const { code } = await params;
  const k = await getKey(decodeURIComponent(code));
  if (!k) return fail("Anahtar bulunamadı.", 404);
  await deleteKey(k.code);
  await addLog("key_deleted", `${k.code} silindi`);
  return json({ keys: await listKeys(), now: Date.now() });
});
