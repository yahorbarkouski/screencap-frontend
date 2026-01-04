import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { sql } from "@vercel/postgres";
import { createProject } from "@/lib/db/queries";
import { generateWriteKey, hashWriteKey } from "@/lib/db/crypto";
import type { CreateProjectResponse } from "@/lib/db/types";
import { SignedRequestError, verifySignedRequest } from "@/lib/auth/verify";

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

  try {
    const body = await request.json();
    const name = body.name?.trim();

    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { error: "Project name is required" },
        { status: 400 }
      );
    }

    const publicId = nanoid(12);
    const writeKey = generateWriteKey();
    const writeKeyHash = hashWriteKey(writeKey);

    await createProject(publicId, name, writeKeyHash);

    await sql`
      INSERT INTO rooms (id, kind, name, visibility, created_by)
      VALUES (${publicId}, 'project', ${name}, 'public', ${identity.userId})
      ON CONFLICT (id) DO NOTHING
    `;

    await sql`
      INSERT INTO room_members (room_id, user_id, role)
      VALUES (${publicId}, ${identity.userId}, 'owner')
      ON CONFLICT (room_id, user_id) DO NOTHING
    `;

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin;
    const shareUrl = `${baseUrl}/p/${publicId}`;

    const response: CreateProjectResponse = {
      publicId,
      writeKey,
      shareUrl,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error("Failed to create project:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
