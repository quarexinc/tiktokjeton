import { getOverview } from "@/lib/store";
import { adminRoute, json } from "@/lib/http";

export const dynamic = "force-dynamic";

export const GET = adminRoute(async () => json(await getOverview()));
