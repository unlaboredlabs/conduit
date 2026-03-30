import type { NextRequest } from "next/server";
import { authorizeRequest } from "@/app/lib/auth";
import { stopFrps } from "@/app/lib/controller";
import { jsonError, jsonOk } from "@/app/lib/response";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await authorizeRequest(request);
  if (!auth) {
    return jsonError("Unauthorized.", 401);
  }

  const { id } = await context.params;

  try {
    await stopFrps(id);
    return jsonOk({});
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Unable to queue stop action.",
      500,
    );
  }
}
