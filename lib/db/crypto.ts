import { createHash, randomBytes } from "crypto";

export function generateWriteKey(): string {
  return randomBytes(32).toString("hex");
}

export function hashWriteKey(writeKey: string): string {
  return createHash("sha256").update(writeKey).digest("hex");
}

export function verifyWriteKey(writeKey: string, hash: string): boolean {
  return hashWriteKey(writeKey) === hash;
}
