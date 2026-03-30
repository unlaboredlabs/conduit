import type { NextRequest } from "next/server";
import { authorizeRequest } from "@/app/lib/auth";
import { deleteFrps, getFrps } from "@/app/lib/controller";
import { jsonError, jsonOk } from "@/app/lib/response";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await authorizeRequest(request);
  if (!auth) {
    return jsonError("Unauthorized.", 401);
  }

  const { id } = await context.params;
  const frps = await getFrps(id);

  if (!frps) {
    return jsonError("FRPS instance not found.", 404);
  }

  return jsonOk({ frps });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await authorizeRequest(request);
  if (!auth) {
    return jsonError("Unauthorized.", 401);
  }

  const { id } = await context.params;

  try {
    await deleteFrps(id);
    return jsonOk({});
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Unable to queue deletion.",
      500,
    );
  }
}
