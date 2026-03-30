import type { NextRequest } from "next/server";
import { authorizeRequest } from "@/app/lib/auth";
import { getNode } from "@/app/lib/controller";
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
  const node = await getNode(id);

  if (!node) {
    return jsonError("Node not found.", 404);
  }

  return jsonOk({ node });
}
