import { NextRequest, NextResponse } from "next/server";
import { SignedRequestError, verifySignedRequest } from "@/lib/auth/verify";
import { unblockUser } from "@/lib/db/blocks";

type RouteParams = {
  params: Promise<{ userId: string }>;
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

  const { userId } = await context.params;
  const blockedUserId = userId.trim();
  if (!blockedUserId || blockedUserId.length > 128) {
    return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
  }

  try {
    await unblockUser({ blockerUserId: identity.userId, blockedUserId });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to unblock user:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

