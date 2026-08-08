import { mintConnectToken, toErrorResponse } from "@/lib/connect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const connect_token = await mintConnectToken();
    return Response.json(
      { connect_token },
      {
        headers: {
          "Cache-Control": "no-store",
          Pragma: "no-cache",
        },
      },
    );
  } catch (err) {
    return toErrorResponse(err);
  }
}
