import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import {
  getProjectById,
  getWriteKeyHash,
} from "@/lib/db/queries";
import { verifySignedRequest } from "@/lib/auth/verify";
import type { PublicEventResponse } from "@/lib/db/types";
import { listRoomEvents, setRoomEventImageRef, upsertRoomEvent } from "@/lib/db/roomEvents";
import { nanoid } from "nanoid";
import { sql } from "@vercel/postgres";
import { getRoomCreatedBy, getRoomRole } from "@/lib/db/rooms";
import { verifyWriteKey } from "@/lib/db/crypto";
import { enforceRateLimit, getClientIp, RateLimitError } from "@/lib/auth/rateLimit";

type RouteParams = {
  params: Promise<{ publicId: string }>;
};

export async function GET(
  request: NextRequest,
  context: RouteParams
) {
  try {
    const { publicId } = await context.params;
    const searchParams = request.nextUrl.searchParams;
    const before = searchParams.get("before");
    const since = searchParams.get("since");
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "50", 10),
      100
    );

    const project = await getProjectById(publicId);
    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    const events = await listRoomEvents({
      roomId: publicId,
      since: since ? parseInt(since, 10) : undefined,
      before: before ? parseInt(before, 10) : undefined,
      limit,
    });

    const response: PublicEventResponse[] = events.map((e) => ({
      id: e.id,
      timestampMs: e.timestampMs,
      payloadCiphertext: e.payloadCiphertext,
      imageUrl: e.imageRef,
    }));

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to get events:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  context: RouteParams
) {
  const { publicId } = await context.params;

  const project = await getProjectById(publicId);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  let signedIdentity: { userId: string; deviceId: string } | null = null;
  try {
    signedIdentity = await verifySignedRequest(request);
  } catch {}

  try {
    if (signedIdentity) {
      await enforceRateLimit({
        key: `publish:user:${signedIdentity.userId}`,
        limit: 60,
        windowMs: 60 * 1000,
      });
    } else {
      const ip = getClientIp(request.headers);
      await enforceRateLimit({ key: `publish:ip:${ip}`, limit: 20, windowMs: 60 * 1000 });
    }
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

  let authorUserId: string | null = null;
  if (signedIdentity) {
    const role = await getRoomRole({ roomId: publicId, userId: signedIdentity.userId });
    if (role) {
      authorUserId = signedIdentity.userId;
    }
  }

  if (!authorUserId) {
    const writeKey = request.headers.get("x-write-key")?.trim() ?? "";
    if (!writeKey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const expectedHash = await getWriteKeyHash(publicId);
    if (!expectedHash || !verifyWriteKey(writeKey, expectedHash)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    authorUserId = await getRoomCreatedBy({ roomId: publicId });
    if (!authorUserId) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
  }

  try {
    const formData = await request.formData();
    const eventId = formData.get("eventId") as string;
    const timestampMs = formData.get("timestampMs") as string;
    const payloadCiphertext = formData.get("payloadCiphertext") as string;
    const file = formData.get("file") as File | null;

    if (!eventId || !timestampMs || !payloadCiphertext) {
      return NextResponse.json(
        { error: "eventId, timestampMs, payloadCiphertext are required" },
        { status: 400 }
      );
    }

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    const blobPath = `public/${publicId}/events/${nanoid(32)}.bin`;
    const blob = await put(blobPath, file, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: false,
      contentType: "application/octet-stream",
    });

    await upsertRoomEvent({
      id: eventId,
      roomId: publicId,
      authorUserId,
      timestampMs: parseInt(timestampMs, 10),
      payloadCiphertext: payloadCiphertext.trim(),
    });

    await setRoomEventImageRef({
      roomId: publicId,
      eventId,
      imageRef: blob.url,
    });

    await sql`
      UPDATE published_projects
      SET last_event_at = NOW(), updated_at = NOW()
      WHERE id = ${publicId}
    `;

    const response: PublicEventResponse = {
      id: eventId,
      timestampMs: parseInt(timestampMs, 10),
      payloadCiphertext: payloadCiphertext.trim(),
      imageUrl: blob.url,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error("Failed to create event:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
