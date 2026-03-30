import type { NextRequest } from "next/server";
import { authorizeRequest } from "@/app/lib/auth";
import { createFrps, listFrps } from "@/app/lib/controller";
import { jsonError, jsonOk } from "@/app/lib/response";

export async function GET(request: NextRequest) {
  const auth = await authorizeRequest(request);
  if (!auth) {
    return jsonError("Unauthorized.", 401);
  }

  const frps = await listFrps();
  return jsonOk({ frps });
}

export async function POST(request: NextRequest) {
  const auth = await authorizeRequest(request);
  if (!auth) {
    return jsonError("Unauthorized.", 401);
  }

  const body = await request.json().catch(() => null);
  const name = body?.name;
  const edgeNodeId = body?.edgeNodeId;

  if (typeof name !== "string" || name.trim().length < 2) {
    return jsonError("FRPS name must be at least 2 characters.", 400);
  }

  if (typeof edgeNodeId !== "string") {
    return jsonError("Select an edge node.", 400);
  }

  try {
    const created = await createFrps(name.trim(), edgeNodeId);
    return jsonOk(created, 201);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Unable to create FRPS instance.",
      500,
    );
  }
}
