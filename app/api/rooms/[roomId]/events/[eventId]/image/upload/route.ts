import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { SignedRequestError, verifySignedRequest } from "@/lib/auth/verify";
import { enforceRateLimit, RateLimitError } from "@/lib/auth/rateLimit";
import { getRoomRole } from "@/lib/db/rooms";
import { setRoomEventImageRef } from "@/lib/db/roomEvents";

type RouteParams = {
  params: Promise<{ roomId: string; eventId: string }>;
};

export async function POST(request: Request, context: RouteParams) {
  const { roomId, eventId } = await context.params;
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        let identity;
        try {
          identity = await verifySignedRequest(request as never);
        } catch (error) {
          if (error instanceof SignedRequestError) {
            throw new Error(error.message);
          }
          throw new Error("Auth failed");
        }

        try {
          await enforceRateLimit({
            key: `roomimage:user:${identity.userId}`,
            limit: 60,
            windowMs: 60 * 1000,
          });
        } catch (error) {
          if (error instanceof RateLimitError) {
            throw new Error("Rate limit exceeded");
          }
          throw new Error("Rate limit check failed");
        }

        const role = await getRoomRole({ roomId, userId: identity.userId });
        if (!role) {
          throw new Error("Forbidden");
        }

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
