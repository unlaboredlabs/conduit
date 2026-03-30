import type { NextRequest } from "next/server";
import { authorizeRequest } from "@/app/lib/auth";
import {
  createRegistrationToken,
  listRegistrationTokens,
} from "@/app/lib/controller";
import { jsonError, jsonOk } from "@/app/lib/response";

export async function GET(request: NextRequest) {
  const auth = await authorizeRequest(request);
  if (!auth) {
    return jsonError("Unauthorized.", 401);
  }

  const registrationTokens = await listRegistrationTokens();
  return jsonOk({ registrationTokens });
}

export async function POST(request: NextRequest) {
  const auth = await authorizeRequest(request);
  if (!auth) {
    return jsonError("Unauthorized.", 401);
  }

  const body = await request.json().catch(() => null);
  const label = body?.label;
  const ttlHours = body?.ttlHours;

  if (typeof label !== "string" || label.trim().length < 2) {
    return jsonError("Label must be at least 2 characters.", 400);
  }

  const created = await createRegistrationToken(
    label.trim(),
    typeof ttlHours === "number" ? Math.max(1, Math.min(ttlHours, 168)) : 24,
  );

  return jsonOk({ registrationToken: created }, 201);
}
