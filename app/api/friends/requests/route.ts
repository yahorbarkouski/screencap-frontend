import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { SignedRequestError, verifySignedRequest } from "@/lib/auth/verify";
import { getUserByUsername } from "@/lib/db/users";
import { enforceRateLimit, RateLimitError } from "@/lib/auth/rateLimit";
import { isBlockedEitherWay } from "@/lib/db/blocks";
import {
  acceptFriendRequest,
  areFriends,
  getPendingReverseFriendRequest,
  listFriendRequestsForUser,
  upsertPendingFriendRequest,
} from "@/lib/db/friends";

function normalizeUsername(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,32}$/.test(trimmed)) return null;
  return trimmed;
}

export async function GET(request: NextRequest) {
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

  const requests = await listFriendRequestsForUser(identity.userId);
  return NextResponse.json(requests);
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
      key: `friendreq:user:${identity.userId}`,
      limit: 30,
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
  const toUsername = normalizeUsername(obj?.toUsername);
  if (!toUsername) {
    return NextResponse.json({ error: "Invalid username" }, { status: 400 });
  }

  const toUser = await getUserByUsername(toUsername);
  if (!toUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (await isBlockedEitherWay({ userIdA: identity.userId, userIdB: toUser.id })) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (toUser.id === identity.userId) {
    return NextResponse.json(
      { error: "Cannot friend yourself" },
      { status: 400 }
    );
  }

  if (await areFriends({ userIdA: identity.userId, userIdB: toUser.id })) {
    return NextResponse.json({ error: "Already friends" }, { status: 409 });
  }

  const reversePending = await getPendingReverseFriendRequest({
    fromUserId: identity.userId,
    toUserId: toUser.id,
  });

  if (reversePending) {
    try {
      await acceptFriendRequest({
        requestId: reversePending.id,
        userId: identity.userId,
      });
      return NextResponse.json({ requestId: reversePending.id, status: "accepted" });
    } catch (error) {
      console.error("Failed to accept reverse request:", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  }

  const requestId = nanoid(21);
  try {
    const created = await upsertPendingFriendRequest({
      requestId,
      fromUserId: identity.userId,
      toUserId: toUser.id,
    });
    return NextResponse.json({ requestId: created.id, status: created.status });
  } catch (error) {
    console.error("Failed to create friend request:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

