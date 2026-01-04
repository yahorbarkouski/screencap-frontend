import { NextRequest, NextResponse } from "next/server";
import { verifySignedRequest, SignedRequestError } from "@/lib/auth/verify";
import { renameUser } from "@/lib/db/users";
import { enforceRateLimit, RateLimitError } from "@/lib/auth/rateLimit";

function normalizeUsername(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,32}$/.test(trimmed)) return null;
  return trimmed;
}

export async function POST(request: NextRequest) {
  let identity;
  try {
    identity = await verifySignedRequest(request);
  } catch (error) {
    if (error instanceof SignedRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Auth failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  try {
    await enforceRateLimit({
      key: `rename:user:${identity.userId}`,
      limit: 5,
      windowMs: 24 * 60 * 60 * 1000,
    });
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
  if (!username) {
    return NextResponse.json({ error: "Invalid username" }, { status: 400 });
  }

  try {
    const updated = await renameUser({ userId: identity.userId, username });
    return NextResponse.json({ userId: updated.id, username: updated.username });
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
    console.error("Failed to rename user:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

