import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { createPublicKey } from "crypto";
import { createUserWithDevice, getUserByUsername } from "@/lib/db/users";
import { enforceRateLimit, getClientIp, RateLimitError } from "@/lib/auth/rateLimit";

function normalizeUsername(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,32}$/.test(trimmed)) return null;
  return trimmed;
}

function validateSpkiKeyB64(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (trimmed.length === 0 || trimmed.length > 4096) return null;
  try {
    createPublicKey({
      key: Buffer.from(trimmed, "base64"),
      format: "der",
      type: "spki",
    });
    return trimmed;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers);
    await enforceRateLimit({ key: `register:ip:${ip}`, limit: 5, windowMs: 60 * 60 * 1000 });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        {
          status: 429,
          headers: { "Retry-After": String(error.retryAfterSeconds) },
        }
      );
    }
    console.error("Rate limit failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  let body: unknown;
  try {
    body = (await request.json()) as unknown;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const obj =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : null;
  const username = normalizeUsername(obj?.username);
  const signPubKey = validateSpkiKeyB64(obj?.signPubKey);
  const dhPubKey = validateSpkiKeyB64(obj?.dhPubKey);

  if (!username || !signPubKey || !dhPubKey) {
    return NextResponse.json(
      { error: "Invalid username or device keys" },
      { status: 400 }
    );
  }

  const existing = await getUserByUsername(username);
  if (existing) {
    return NextResponse.json(
      { error: "Username already taken" },
      { status: 409 }
    );
  }

  const userId = nanoid(21);
  const deviceId = nanoid(21);

  try {
    await createUserWithDevice({
      userId,
      deviceId,
      username,
      signPubKey,
      dhPubKey,
    });
  } catch (error: unknown) {
    const code =
      typeof (error as { code?: unknown } | null)?.code === "string"
        ? (error as { code: string }).code
        : null;
    if (code === "23505") {
      return NextResponse.json(
        { error: "Username already taken" },
        { status: 409 }
      );
    }
    console.error("Failed to register user:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ userId, deviceId, username }, { status: 201 });
}

