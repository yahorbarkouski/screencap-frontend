import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { SignedRequestError, verifySignedRequest } from "@/lib/auth/verify";
import { createRoom, listRoomsForUser, type RoomKind, type RoomVisibility } from "@/lib/db/rooms";

function normalizeName(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (trimmed.length < 1 || trimmed.length > 200) return null;
  return trimmed;
}

function parseKind(input: unknown): RoomKind | null {
  if (input === "project") return "project";
  return null;
}

function parseVisibility(input: unknown): RoomVisibility | null {
  if (input === "private" || input === "public") return input;
  return null;
}

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

  const rooms = await listRoomsForUser(identity.userId);
  return NextResponse.json(rooms);
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

  const kind = parseKind(obj?.kind) ?? "project";
  const visibility = parseVisibility(obj?.visibility) ?? "private";
  const name = normalizeName(obj?.name);

  if (!name) {
    return NextResponse.json({ error: "Invalid room name" }, { status: 400 });
  }

  const roomId = nanoid(21);
  try {
    const room = await createRoom({
      roomId,
      createdByUserId: identity.userId,
      kind,
      name,
      visibility,
    });
    return NextResponse.json(room, { status: 201 });
  } catch (error) {
    console.error("Failed to create room:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

