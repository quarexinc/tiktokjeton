import Home, { type Viewer } from "@/components/Home";
import Gate from "@/components/Gate";
import Maintenance from "@/components/Maintenance";
import { getAccess, type Access } from "@/lib/auth";
import { getPublicPayload, type PublicPayload } from "@/lib/public";
import { DEFAULT_SETTINGS } from "@/lib/types";
import { usesLeft } from "@/lib/keys";

export const dynamic = "force-dynamic";

export default async function Page() {
  let access: Access;
  try {
    access = await getAccess();
  } catch (e) {
    console.error("Erişim kontrol edilemedi", e);
    access = { admin: false, member: null, settings: DEFAULT_SETTINGS, allowed: false, blockedByMaintenance: false };
  }

  if (access.blockedByMaintenance) return <Maintenance text={access.settings.maintenanceText} />;
  if (!access.allowed) return <Gate contactUrl={access.settings.contactUrl} contactLabel={access.settings.contactLabel} />;

  let payload: PublicPayload;
  try {
    payload = await getPublicPayload();
  } catch (e) {
    console.error("Veri okunamadı", e);
    payload = { now: Date.now(), announcement: "", showPast: true, streams: [] };
  }

  const m = access.member;
  const viewer: Viewer = {
    admin: access.admin,
    member: m ? { code: m.code, expiresAt: m.expiresAt, usesLeft: usesLeft(m) } : null,
  };
  return <Home initial={payload} viewer={viewer} />;
}
