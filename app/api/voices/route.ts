import { fetchVoices, toErrorResponse } from "@/lib/connect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await fetchVoices());
  } catch (err) {
    return toErrorResponse(err);
  }
}
