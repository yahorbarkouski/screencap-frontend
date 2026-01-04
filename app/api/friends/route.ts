import { NextRequest, NextResponse } from "next/server";
import { SignedRequestError, verifySignedRequest } from "@/lib/auth/verify";
import { listFriends } from "@/lib/db/friends";

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

  const friends = await listFriends(identity.userId);
  return NextResponse.json(friends);
}

