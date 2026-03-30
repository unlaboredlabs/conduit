import type { NextRequest } from "next/server";
import { authorizeRequest } from "@/app/lib/auth";
import { listNodes } from "@/app/lib/controller";
import { jsonError, jsonOk } from "@/app/lib/response";

export async function GET(request: NextRequest) {
  const auth = await authorizeRequest(request);
  if (!auth) {
    return jsonError("Unauthorized.", 401);
  }

  const nodes = await listNodes();
  return jsonOk({ nodes });
}
