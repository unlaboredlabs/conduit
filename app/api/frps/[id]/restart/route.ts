import type { NextRequest } from "next/server";
import { authorizeRequest } from "@/app/lib/auth";
import { restartFrps } from "@/app/lib/controller";
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
    await restartFrps(id);
    return jsonOk({});
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Unable to queue restart action.",
      500,
    );
  }
}
