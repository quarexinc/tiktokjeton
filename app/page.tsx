import Home from "@/components/Home";
import { getPublicPayload, type PublicPayload } from "@/lib/public";

export const dynamic = "force-dynamic";

export default async function Page() {
  let payload: PublicPayload;
  try {
    payload = await getPublicPayload();
  } catch (e) {
    console.error("Veri okunamadı", e);
    payload = { now: Date.now(), announcement: "", showPast: true, streams: [] };
  }
  return <Home initial={payload} />;
}
