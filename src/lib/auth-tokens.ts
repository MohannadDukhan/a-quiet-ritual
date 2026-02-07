import { createHash, randomBytes } from "node:crypto";

export function createRawToken() {
  return randomBytes(32).toString("base64url");
}

export function hashToken(rawToken: string) {
  return createHash("sha256").update(rawToken).digest("hex");
}

export function tokenExpiry(minutes = 60) {
  return new Date(Date.now() + minutes * 60 * 1000);
}
