import { fetchAvatars, toErrorResponse } from "@/lib/connect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await fetchAvatars());
  } catch (err) {
    return toErrorResponse(err);
  }
}
