import { NextResponse } from "next/server";

export const jsonError = (message: string, status = 400) =>
  NextResponse.json(
    {
      ok: false,
      error: message,
    },
    { status },
  );

export const jsonOk = <T>(payload: T, status = 200) =>
  NextResponse.json(
    {
      ok: true,
      ...payload,
    },
    { status },
  );
