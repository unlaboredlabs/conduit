import type { NextRequest } from "next/server";
import { createSession } from "@/app/lib/session";
import { verifyAdminCredentials } from "@/app/lib/auth";
import { jsonError, jsonOk } from "@/app/lib/response";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const username = body?.username;
  const password = body?.password;

  if (typeof username !== "string" || typeof password !== "string") {
    return jsonError("Provide a username and password.", 400);
  }

  if (!verifyAdminCredentials(username, password)) {
    return jsonError("Invalid admin credentials.", 401);
  }

  await createSession();
  return jsonOk({});
}
