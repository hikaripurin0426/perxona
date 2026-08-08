import { isConnectConfigured, getDefaults, getPresenterUrl } from "@/lib/connect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const connect = isConnectConfigured();
  return Response.json({
    chat: connect,
    connectChatbot: connect,
    levelAssess: connect,
    presenterUrl: getPresenterUrl(),
    defaults: getDefaults(),
  });
}
