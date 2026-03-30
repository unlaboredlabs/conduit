import type { NextRequest } from "next/server";
import { registerAgentNode } from "@/app/lib/controller";
import { jsonError, jsonOk } from "@/app/lib/response";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (
    typeof body?.registrationToken !== "string" ||
    typeof body?.label !== "string" ||
    typeof body?.hostname !== "string" ||
    typeof body?.vultrInstanceId !== "string" ||
    typeof body?.region !== "string" ||
    typeof body?.agentVersion !== "string"
  ) {
    return jsonError("Invalid agent registration payload.", 400);
  }

  try {
    const registration = await registerAgentNode({
      registrationToken: body.registrationToken,
      label: body.label,
      hostname: body.hostname,
      vultrInstanceId: body.vultrInstanceId,
      region: body.region,
      agentVersion: body.agentVersion,
      dockerVersion:
        typeof body?.dockerVersion === "string" ? body.dockerVersion : null,
    });

    return jsonOk(registration, 201);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Unable to register edge node.",
      400,
    );
  }
}
