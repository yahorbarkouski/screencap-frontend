import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { createProject } from "@/lib/db/queries";
import { generateWriteKey, hashWriteKey } from "@/lib/db/crypto";
import type { CreateProjectResponse } from "@/lib/db/types";

export async function POST(request: NextRequest) {
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
