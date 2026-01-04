import { NextRequest, NextResponse } from "next/server";
import { SignedRequestError, verifySignedRequest } from "@/lib/auth/verify";
import { listIncomingRoomInvitesForUser } from "@/lib/db/rooms";

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
    const invites = await listIncomingRoomInvitesForUser({ userId: identity.userId });
    return NextResponse.json(invites);
  } catch (error) {
    console.error("Failed to list room invites:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

