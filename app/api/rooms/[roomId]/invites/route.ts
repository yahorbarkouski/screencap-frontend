import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { SignedRequestError, verifySignedRequest } from "@/lib/auth/verify";
import { enforceRateLimit, RateLimitError } from "@/lib/auth/rateLimit";
import { isBlockedEitherWay } from "@/lib/db/blocks";
import { areFriends } from "@/lib/db/friends";
import { createRoomInvite, getRoomRole, listIncomingRoomInvites } from "@/lib/db/rooms";
import { listUserDevices } from "@/lib/db/users";

type RouteParams = {
  params: Promise<{ roomId: string }>;
};

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
  try {
    const invites = await listIncomingRoomInvites({ roomId, userId: identity.userId });
    return NextResponse.json(invites);
  } catch (error) {
    console.error("Failed to list invites:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
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
      key: `roominvite:user:${identity.userId}`,
      limit: 60,
      windowMs: 60 * 60 * 1000,
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
  const toUserId = typeof obj?.toUserId === "string" ? obj.toUserId.trim() : "";
  if (!toUserId) {
    return NextResponse.json({ error: "toUserId is required" }, { status: 400 });
  }

  if (toUserId === identity.userId) {
    return NextResponse.json({ error: "Cannot invite yourself" }, { status: 400 });
  }

  if (await isBlockedEitherWay({ userIdA: identity.userId, userIdB: toUserId })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!(await areFriends({ userIdA: identity.userId, userIdB: toUserId }))) {
    return NextResponse.json({ error: "Can only invite friends" }, { status: 403 });
  }

  const inviteId = nanoid(21);
  try {
    await createRoomInvite({
      inviteId,
      roomId,
      fromUserId: identity.userId,
      toUserId,
    });
    const devices = await listUserDevices(toUserId);
    return NextResponse.json(
      {
        inviteId,
        devices: devices.map((d) => ({
          deviceId: d.id,
          dhPubKey: d.dh_pub_key,
        })),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create invite:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

