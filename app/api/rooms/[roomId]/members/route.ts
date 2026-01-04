import { NextRequest, NextResponse } from "next/server";
import { SignedRequestError, verifySignedRequest } from "@/lib/auth/verify";
import { getRoomRole, listRoomMembers } from "@/lib/db/rooms";

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

  const role = await getRoomRole({ roomId, userId: identity.userId });
  if (!role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const members = await listRoomMembers({ roomId });
    return NextResponse.json(members);
  } catch (error) {
    console.error("Failed to list room members:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
