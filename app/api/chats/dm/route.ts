import { NextRequest, NextResponse } from "next/server";
import { SignedRequestError, verifySignedRequest } from "@/lib/auth/verify";
import { getOrCreateDmThread } from "@/lib/db/chats";
import { isBlockedEitherWay } from "@/lib/db/blocks";

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
  const friendUserId = typeof obj?.friendUserId === "string" ? obj.friendUserId.trim() : "";
  if (!friendUserId) {
    return NextResponse.json({ error: "friendUserId is required" }, { status: 400 });
  }

  if (friendUserId === identity.userId) {
    return NextResponse.json({ error: "Invalid friendUserId" }, { status: 400 });
  }

  if (await isBlockedEitherWay({ userIdA: identity.userId, userIdB: friendUserId })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const threadId = await getOrCreateDmThread({
      userId: identity.userId,
      friendUserId,
    });
    return NextResponse.json({ threadId }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "";
    if (message === "Not friends") {
      return NextResponse.json({ error: "Not friends" }, { status: 403 });
    }
    console.error("Failed to create DM thread:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

