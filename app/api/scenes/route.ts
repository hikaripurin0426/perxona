import { fetchScenes, toErrorResponse } from "@/lib/connect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await fetchScenes());
  } catch (err) {
    return toErrorResponse(err);
  }
}
