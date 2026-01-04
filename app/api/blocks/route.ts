import { NextRequest, NextResponse } from "next/server";
import { SignedRequestError, verifySignedRequest } from "@/lib/auth/verify";
import { blockUser, listBlockedUsers } from "@/lib/db/blocks";
import { getUserById } from "@/lib/db/users";

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

  try {
    const blocked = await listBlockedUsers({ blockerUserId: identity.userId });
    return NextResponse.json(blocked);
  } catch (error) {
    console.error("Failed to list blocks:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
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
  const userId = typeof obj?.userId === "string" ? obj.userId.trim() : "";
  if (!userId || userId.length > 128) {
    return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
  }
  if (userId === identity.userId) {
    return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
  }

  const target = await getUserById(userId);
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  try {
    await blockUser({ blockerUserId: identity.userId, blockedUserId: userId });
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("Failed to block user:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

