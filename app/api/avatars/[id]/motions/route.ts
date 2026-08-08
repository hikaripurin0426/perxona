import { fetchAvatarMotions, toErrorResponse } from "@/lib/connect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    if (!id) {
      return Response.json({ error: "avatar id required" }, { status: 400 });
    }
    const items = await fetchAvatarMotions(id);
    return Response.json({ items });
  } catch (err) {
    return toErrorResponse(err);
  }
}
