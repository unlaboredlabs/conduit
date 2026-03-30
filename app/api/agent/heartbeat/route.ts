import type { NextRequest } from "next/server";
import {
  authenticateAgentNode,
  recordAgentHeartbeat,
} from "@/app/lib/controller";
import { jsonError, jsonOk } from "@/app/lib/response";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (
    typeof body?.nodeId !== "string" ||
    typeof body?.agentToken !== "string" ||
    typeof body?.hostname !== "string" ||
    typeof body?.agentVersion !== "string" ||
    typeof body?.runningContainers !== "number"
  ) {
    return jsonError("Invalid heartbeat payload.", 400);
  }

  const node = await authenticateAgentNode(body.nodeId, body.agentToken);
  if (!node) {
    return jsonError("Unauthorized agent.", 401);
  }

  await recordAgentHeartbeat({
    nodeId: body.nodeId,
    hostname: body.hostname,
    agentVersion: body.agentVersion,
    dockerVersion:
      typeof body?.dockerVersion === "string" ? body.dockerVersion : null,
    runningContainers: body.runningContainers,
  });

  return jsonOk({});
}
