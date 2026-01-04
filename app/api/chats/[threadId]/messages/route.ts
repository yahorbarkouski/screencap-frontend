import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { SignedRequestError, verifySignedRequest } from "@/lib/auth/verify";
import { enforceRateLimit, RateLimitError } from "@/lib/auth/rateLimit";
import { insertChatMessage, listChatMessages } from "@/lib/db/chats";

type RouteParams = {
  params: Promise<{ threadId: string }>;
};

function parseQueryNumber(value: string | null): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n)) return undefined;
  return Math.trunc(n);
}

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

  const { threadId } = await context.params;

  const sp = request.nextUrl.searchParams;
  const since = parseQueryNumber(sp.get("since"));
  const limit = parseQueryNumber(sp.get("limit"));

  try {
    const messages = await listChatMessages({
      threadId,
      userId: identity.userId,
      since,
      limit,
    });
    return NextResponse.json(messages);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "";
    if (message === "Not a thread member") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Failed to list messages:", error);
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
      key: `chatmsg:user:${identity.userId}`,
      limit: 120,
      windowMs: 60 * 1000,
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

  const { threadId } = await context.params;

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

  const messageId =
    typeof obj?.messageId === "string" ? obj.messageId.trim() : nanoid(21);
  const ts = obj?.timestampMs;
  const timestampMs =
    typeof ts === "number" && Number.isFinite(ts)
      ? Math.trunc(ts)
      : typeof ts === "string" && ts.trim()
        ? Math.trunc(Number(ts))
        : NaN;
  const ciphertext = typeof obj?.ciphertext === "string" ? obj.ciphertext.trim() : "";

  if (!messageId || messageId.length > 128) {
    return NextResponse.json({ error: "Invalid messageId" }, { status: 400 });
  }
  if (!Number.isFinite(timestampMs) || timestampMs <= 0) {
    return NextResponse.json({ error: "Invalid timestampMs" }, { status: 400 });
  }
  if (!ciphertext || ciphertext.length > 200000) {
    return NextResponse.json({ error: "Invalid ciphertext" }, { status: 400 });
  }

  try {
    await insertChatMessage({
      messageId,
      threadId,
      authorUserId: identity.userId,
      timestampMs,
      ciphertext,
    });
    return NextResponse.json({ success: true, messageId }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "";
    if (message === "Not a thread member") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Failed to post message:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

