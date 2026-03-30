import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { env } from "@/app/lib/env";

const COOKIE_NAME = "conduit_session";

type SessionPayload = {
  sub: "admin";
  role: "admin";
};

const getKey = () => new TextEncoder().encode(env.sessionSecret());

export const createSession = async () => {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const token = await new SignJWT({ role: "admin" satisfies SessionPayload["role"] })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("admin")
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getKey());

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  });
};

export const readSession = async (): Promise<SessionPayload | null> => {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, getKey(), {
      algorithms: ["HS256"],
    });

    if (payload.sub !== "admin" || payload.role !== "admin") {
      return null;
    }

    return {
      sub: "admin",
      role: "admin",
    };
  } catch {
    return null;
  }
};

export const deleteSession = async () => {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
};
