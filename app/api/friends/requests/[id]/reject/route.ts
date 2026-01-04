import { NextRequest, NextResponse } from "next/server";
import { SignedRequestError, verifySignedRequest } from "@/lib/auth/verify";
import { rejectFriendRequest } from "@/lib/db/friends";

type RouteParams = {
  params: Promise<{ id: string }>;
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

  const { id } = await context.params;
  try {
    await rejectFriendRequest({ requestId: id, userId: identity.userId });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error";
    if (message.includes("not found")) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }
    if (message.includes("Not authorized")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (message.includes("not pending")) {
      return NextResponse.json({ error: "Request is not pending" }, { status: 409 });
    }
    console.error("Failed to reject friend request:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

