import { NextRequest, NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { SignedRequestError, verifySignedRequest } from "@/lib/auth/verify";
import { enforceRateLimit, RateLimitError } from "@/lib/auth/rateLimit";
import { getRoomRole } from "@/lib/db/rooms";
import { deleteRoomEvent } from "@/lib/db/roomEvents";

type RouteParams = {
  params: Promise<{ roomId: string; eventId: string }>;
};

export async function DELETE(request: NextRequest, context: RouteParams) {
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
      key: `roomevent:delete:${identity.userId}`,
      limit: 30,
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

  try {
    const deleted = await deleteRoomEvent({
      eventId,
      roomId,
      authorUserId: identity.userId,
    });

    if (!deleted) {
      return NextResponse.json({ error: "Event not found or not owned by you" }, { status: 404 });
    }

    if (deleted.image_ref) {
      try {
        await del(deleted.image_ref);
      } catch (blobError) {
        console.error("Failed to delete blob:", blobError);
      }
    }

    return NextResponse.json({ deleted: true, eventId: deleted.id });
  } catch (error) {
    console.error("Failed to delete room event:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
