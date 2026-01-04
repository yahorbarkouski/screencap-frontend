import { NextRequest, NextResponse } from "next/server";
import { SignedRequestError, verifySignedRequest } from "@/lib/auth/verify";
import {
  acceptRoomInviteIfPending,
  getRoomMemberKeyEnvelope,
  getRoomRole,
  isUserInvitedToRoom,
  upsertRoomMemberKeyEnvelopes,
} from "@/lib/db/rooms";

type RouteParams = {
  params: Promise<{ roomId: string }>;
};

type EnvelopeInput = { deviceId: string; envelopeJson: string };

function parseEnvelopes(input: unknown): EnvelopeInput[] | null {
  if (!Array.isArray(input)) return null;
  const out: EnvelopeInput[] = [];

  for (const item of input) {
    const obj =
      typeof item === "object" && item !== null
        ? (item as Record<string, unknown>)
        : null;
    const deviceId =
      typeof obj?.deviceId === "string" ? obj.deviceId.trim() : "";
    const envelopeJson =
      typeof obj?.envelopeJson === "string"
        ? obj.envelopeJson.trim()
        : "";
    if (!deviceId || !envelopeJson) return null;
    if (deviceId.length > 128 || envelopeJson.length > 10000) return null;
    out.push({ deviceId, envelopeJson });
  }
  return out;
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

  const { roomId } = await context.params;
  const role = await getRoomRole({ roomId, userId: identity.userId });
  const invited = role ? false : await isUserInvitedToRoom({ roomId, userId: identity.userId });

  if (!role && !invited) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const envelopeJson = await getRoomMemberKeyEnvelope({
    roomId,
    deviceId: identity.deviceId,
  });
  if (!envelopeJson) {
    return NextResponse.json({ error: "Envelope not found" }, { status: 404 });
  }

  if (!role) {
    try {
      await acceptRoomInviteIfPending({ roomId, userId: identity.userId });
    } catch (error) {
      console.error("Failed to accept invite:", error);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  }

  return NextResponse.json({ envelopeJson });
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

  const { roomId } = await context.params;
  const role = await getRoomRole({ roomId, userId: identity.userId });
  if (!role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
  const envelopes = parseEnvelopes(obj?.envelopes);
  if (!envelopes || envelopes.length === 0) {
    return NextResponse.json({ error: "Invalid envelopes" }, { status: 400 });
  }

  try {
    await upsertRoomMemberKeyEnvelopes({ roomId, envelopes });
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("Failed to store envelopes:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

