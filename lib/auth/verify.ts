import type { NextRequest } from "next/server";
import { sql } from "@vercel/postgres";
import { createHash, createPublicKey, verify } from "crypto";

export class SignedRequestError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export type SignedRequestIdentity = {
  userId: string;
  deviceId: string;
};

function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function canonicalString(params: {
  method: string;
  path: string;
  ts: string;
  bodyHashHex: string;
}): string {
  return `${params.method.toUpperCase()}\n${params.path}\n${params.ts}\n${params.bodyHashHex}`;
}

async function loadDeviceSigningKey(params: {
  userId: string;
  deviceId: string;
}): Promise<string | null> {
  const result = await sql<{ sign_pub_key: string }>`
    SELECT sign_pub_key
    FROM user_devices
    WHERE id = ${params.deviceId} AND user_id = ${params.userId}
  `;
  return result.rows[0]?.sign_pub_key ?? null;
}

export async function verifySignedRequest(
  request: NextRequest,
  options?: { windowMs?: number }
): Promise<SignedRequestIdentity> {
  const userId = request.headers.get("x-user-id")?.trim();
  const deviceId = request.headers.get("x-device-id")?.trim();
  const tsRaw = request.headers.get("x-ts")?.trim();
  const sigB64 = request.headers.get("x-sig")?.trim();

  if (!userId || !deviceId || !tsRaw || !sigB64) {
    throw new SignedRequestError(401, "Missing auth headers");
  }

  const tsMs = Number(tsRaw);
  if (!Number.isFinite(tsMs)) {
    throw new SignedRequestError(400, "Invalid x-ts");
  }

  const windowMs = options?.windowMs ?? 5 * 60 * 1000;
  if (Math.abs(Date.now() - tsMs) > windowMs) {
    throw new SignedRequestError(401, "Request expired");
  }

  let signature: Buffer;
  try {
    signature = Buffer.from(sigB64, "base64");
  } catch {
    throw new SignedRequestError(400, "Invalid x-sig");
  }

  const bodyBytes = new Uint8Array(await request.clone().arrayBuffer());
  const bodyHashHex = sha256Hex(bodyBytes);
  const path = request.nextUrl.pathname;

  const deviceKeyB64 = await loadDeviceSigningKey({ userId, deviceId });
  if (!deviceKeyB64) {
    throw new SignedRequestError(401, "Unknown device");
  }

  let publicKey;
  try {
    publicKey = createPublicKey({
      key: Buffer.from(deviceKeyB64, "base64"),
      format: "der",
      type: "spki",
    });
  } catch {
    throw new SignedRequestError(500, "Invalid device signing key");
  }

  const canonical = canonicalString({
    method: request.method,
    path,
    ts: tsRaw,
    bodyHashHex,
  });

  const ok = verify(null, Buffer.from(canonical, "utf8"), publicKey, signature);
  if (!ok) {
    throw new SignedRequestError(403, "Invalid signature");
  }

  await sql`
    UPDATE user_devices
    SET last_seen_at = NOW()
    WHERE id = ${deviceId}
  `;

  return { userId, deviceId };
}

