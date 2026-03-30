import { cache } from "react";
import type { NextRequest } from "next/server";
import { env } from "@/app/lib/env";
import { safeEqual } from "@/app/lib/crypto";
import { readSession } from "@/app/lib/session";

export const verifySession = cache(async () => readSession());

export const verifyAdminCredentials = (username: string, password: string) =>
  safeEqual(username, env.adminUsername()) &&
  safeEqual(password, env.adminPassword());

export const authorizeRequest = async (request: NextRequest) => {
  const header = request.headers.get("authorization");
  if (header?.startsWith("Bearer ")) {
    const token = header.slice("Bearer ".length);
    if (safeEqual(token, env.adminApiToken())) {
      return { kind: "bearer" as const };
    }
  }

  const session = await readSession();
  if (session?.role === "admin") {
    return { kind: "session" as const };
  }

  return null;
};
