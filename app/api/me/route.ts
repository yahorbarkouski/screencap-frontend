import { NextRequest, NextResponse } from "next/server";
import { verifySignedRequest, SignedRequestError } from "@/lib/auth/verify";
import { getUserById, listUserDevices } from "@/lib/db/users";

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

