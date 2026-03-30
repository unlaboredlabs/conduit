import type { NextRequest } from "next/server";
import {
  authenticateAgentNode,
  cleanupDeletedFrpsIp,
  completeAgentJob,
  getJob,
} from "@/app/lib/controller";
import { jsonError, jsonOk } from "@/app/lib/response";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const body = await request.json().catch(() => null);

  if (
    typeof body?.nodeId !== "string" ||
    typeof body?.agentToken !== "string" ||
    (body?.status !== "succeeded" && body?.status !== "failed")
  ) {
    return jsonError("Invalid job completion payload.", 400);
  }

  const node = await authenticateAgentNode(body.nodeId, body.agentToken);
  if (!node) {
    return jsonError("Unauthorized agent.", 401);
  }

  const { id } = await context.params;
  const job = await getJob(id);
  if (!job) {
    return jsonError("Job not found.", 404);
  }

  if (job.targetNodeId !== body.nodeId) {
    return jsonError("Job is not assigned to this node.", 403);
  }

  if (body.status === "succeeded" && job.kind === "delete_frps" && job.frpsInstanceId) {
    try {
      await cleanupDeletedFrpsIp(job.frpsInstanceId);
    } catch (error) {
      await completeAgentJob({
        jobId: id,
        status: "failed",
        message:
          error instanceof Error
            ? `Controller cleanup failed: ${error.message}`
            : "Controller cleanup failed.",
      });
      return jsonError("Controller cleanup failed.", 500);
    }
  }

  await completeAgentJob({
    jobId: id,
    status: body.status,
    message: typeof body?.message === "string" ? body.message : undefined,
    containerName:
      typeof body?.containerName === "string" ? body.containerName : undefined,
  });

  return jsonOk({});
}
