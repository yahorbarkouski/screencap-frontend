import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { SignedRequestError, verifySignedRequest } from "@/lib/auth/verify";
import { enforceRateLimit, RateLimitError } from "@/lib/auth/rateLimit";
import { getRoomRole } from "@/lib/db/rooms";
import { setRoomEventImageRef } from "@/lib/db/roomEvents";

type RouteParams = {
  params: Promise<{ roomId: string; eventId: string }>;
};

export async function POST(request: NextRequest, context: RouteParams) {
  const { roomId, eventId } = await context.params;

  let identity;
  try {
    identity = await verifySignedRequest(request);
  } catch (error) {
    if (error instanceof SignedRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Auth failed" }, { status: 500 });
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
    return NextResponse.json({ error: "Rate limit check failed" }, { status: 500 });
  }

  const role = await getRoomRole({ roomId, userId: identity.userId });
  if (!role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        return {
          allowedContentTypes: ["application/octet-stream"],
          maximumSizeInBytes: 50 * 1024 * 1024,
          tokenPayload: JSON.stringify({ roomId, eventId }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const payload = JSON.parse(tokenPayload ?? "{}");
        await setRoomEventImageRef({
          roomId: payload.roomId,
          eventId: payload.eventId,
          imageRef: blob.url,
        });
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error("Upload handler error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 400 }
    );
  }
}
