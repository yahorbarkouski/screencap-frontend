import { NextRequest, NextResponse } from "next/server";
import { SignedRequestError, verifySignedRequest } from "@/lib/auth/verify";
import { enforceRateLimit, RateLimitError } from "@/lib/auth/rateLimit";
import { getRoomRole } from "@/lib/db/rooms";
import { listRoomEvents, upsertRoomEvent } from "@/lib/db/roomEvents";

type RouteParams = {
  params: Promise<{ roomId: string }>;
};

function parseLimit(value: string | null): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(Math.max(Math.trunc(n), 1), 200);
}

function parseTimestamp(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return Math.trunc(n);
  }
  return null;
}

function parseQueryNumber(value: string | null): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n)) return undefined;
  return Math.trunc(n);
}

export async function GET(request: NextRequest, context: RouteParams) {
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

  const { roomId } = await context.params;
  const role = await getRoomRole({ roomId, userId: identity.userId });
  if (!role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sp = request.nextUrl.searchParams;
  const since = parseQueryNumber(sp.get("since"));
  const before = parseQueryNumber(sp.get("before"));
  const limit = parseLimit(sp.get("limit"));

  const events = await listRoomEvents({
    roomId,
    since,
    before,
    limit,
  });

  return NextResponse.json(events);
}

export async function POST(request: NextRequest, context: RouteParams) {
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
      key: `roomevent:user:${identity.userId}`,
      limit: 60,
      windowMs: 60 * 1000,
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } }
      );
    }
    console.error("Rate limit failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  const { roomId } = await context.params;
  const role = await getRoomRole({ roomId, userId: identity.userId });
  if (!role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

  const idRaw = obj?.eventId ?? obj?.id;
  const eventId = typeof idRaw === "string" ? idRaw.trim() : "";
  const timestampMs = parseTimestamp(obj?.timestampMs);
  const payloadCiphertext =
    typeof obj?.payloadCiphertext === "string"
      ? obj.payloadCiphertext.trim()
      : "";

  if (!eventId || eventId.length > 128) {
    return NextResponse.json({ error: "Invalid eventId" }, { status: 400 });
  }
  if (timestampMs === null || timestampMs <= 0) {
    return NextResponse.json({ error: "Invalid timestampMs" }, { status: 400 });
  }
  if (!payloadCiphertext || payloadCiphertext.length > 200000) {
    return NextResponse.json(
      { error: "Invalid payloadCiphertext" },
      { status: 400 }
    );
  }

  try {
    const created = await upsertRoomEvent({
      id: eventId,
      roomId,
      authorUserId: identity.userId,
      timestampMs,
      payloadCiphertext,
    });
    return NextResponse.json(
      { eventId: created.id, createdAt: created.created_at.getTime() },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to upsert room event:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

