import { NextRequest, NextResponse } from "next/server";
import { verifySignedRequest, SignedRequestError } from "@/lib/auth/verify";
import { getUserById, listUserDevices, updateUserAvatarSettings, type AvatarSettings } from "@/lib/db/users";

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

  const user = await getUserById(identity.userId);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const devices = await listUserDevices(identity.userId);

  return NextResponse.json({
    userId: user.id,
    username: user.username,
    avatarSettings: user.avatar_settings,
    deviceId: identity.deviceId,
    devices: devices.map((d) => ({
      id: d.id,
      signPubKey: d.sign_pub_key,
      dhPubKey: d.dh_pub_key,
      createdAt: d.created_at.getTime(),
      lastSeenAt: d.last_seen_at ? d.last_seen_at.getTime() : null,
    })),
  });
}

const VALID_PATTERNS = ["letter", "letterBold", "letterMonospace", "pixelLetter", "ascii"];

function isValidAvatarSettings(value: unknown): value is AvatarSettings {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.pattern === "string" &&
    VALID_PATTERNS.includes(obj.pattern) &&
    typeof obj.backgroundColor === "string" &&
    /^#[0-9a-fA-F]{6}$/.test(obj.backgroundColor) &&
    typeof obj.foregroundColor === "string" &&
    /^#[0-9a-fA-F]{6}$/.test(obj.foregroundColor)
  );
}

export async function PATCH(request: NextRequest) {
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

  const body = await request.json();

  if (body.avatarSettings !== undefined) {
    if (!isValidAvatarSettings(body.avatarSettings)) {
      return NextResponse.json({ error: "Invalid avatar settings" }, { status: 400 });
    }

    const user = await updateUserAvatarSettings({
      userId: identity.userId,
      avatarSettings: body.avatarSettings,
    });

    return NextResponse.json({
      userId: user.id,
      username: user.username,
      avatarSettings: user.avatar_settings,
    });
  }

  return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
}
