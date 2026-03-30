import type { NextRequest } from "next/server";
import { authenticateAgentNode, claimAgentJob } from "@/app/lib/controller";
import { jsonError, jsonOk } from "@/app/lib/response";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (typeof body?.nodeId !== "string" || typeof body?.agentToken !== "string") {
    return jsonError("Invalid job claim payload.", 400);
  }

  const node = await authenticateAgentNode(body.nodeId, body.agentToken);
  if (!node) {
    return jsonError("Unauthorized agent.", 401);
  }

  const job = await claimAgentJob(body.nodeId);
  return jsonOk({ job });
}
