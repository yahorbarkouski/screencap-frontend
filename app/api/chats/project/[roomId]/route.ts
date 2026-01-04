import { NextRequest, NextResponse } from "next/server";
import { SignedRequestError, verifySignedRequest } from "@/lib/auth/verify";
import { getOrCreateProjectThread } from "@/lib/db/chats";

type RouteParams = {
  params: Promise<{ roomId: string }>;
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

  const { roomId } = await context.params;
  try {
    const threadId = await getOrCreateProjectThread({
      userId: identity.userId,
      roomId,
    });
    return NextResponse.json({ threadId }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "";
    if (message === "Not a room member") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Failed to create project thread:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

