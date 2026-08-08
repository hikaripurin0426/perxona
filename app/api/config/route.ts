import { getDefaults, getPresenterUrl } from "@/lib/connect";
import { isChatEnabled } from "@/lib/openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    chat: isChatEnabled(),
    presenterUrl: getPresenterUrl(),
    defaults: getDefaults(),
  });
}
