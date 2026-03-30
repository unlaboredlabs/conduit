import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const hashToken = (value: string) =>
  createHash("sha256").update(value).digest("hex");

export const createOpaqueToken = (prefix: string) =>
  `${prefix}_${randomBytes(24).toString("base64url")}`;

export const previewToken = (value: string) => value.slice(0, 10);

export const safeEqual = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
};

export const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
