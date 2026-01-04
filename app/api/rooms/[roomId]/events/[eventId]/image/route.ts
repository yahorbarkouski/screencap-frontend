import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { nanoid } from "nanoid";
import { SignedRequestError, verifySignedRequest } from "@/lib/auth/verify";
import { enforceRateLimit, RateLimitError } from "@/lib/auth/rateLimit";
import { getRoomRole } from "@/lib/db/rooms";
import { setRoomEventImageRef } from "@/lib/db/roomEvents";

type RouteParams = {
  params: Promise<{ roomId: string; eventId: string }>;
};

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
      key: `roomimage:user:${identity.userId}`,
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

  const { roomId, eventId } = await context.params;
  const role = await getRoomRole({ roomId, userId: identity.userId });
  if (!role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const bytes = Buffer.from(await request.arrayBuffer());
  if (bytes.length === 0) {
    return NextResponse.json({ error: "Empty body" }, { status: 400 });
  }

  const blobPath = `rooms/${roomId}/images/${nanoid(32)}.bin`;
  try {
    const blob = await put(blobPath, new Blob([bytes]), {
      access: "public",
      addRandomSuffix: false,
      contentType: "application/octet-stream",
    });

    await setRoomEventImageRef({ roomId, eventId, imageRef: blob.url });
    return NextResponse.json({ imageRef: blob.url }, { status: 201 });
  } catch (error) {
    console.error("Failed to upload image:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

