import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import {
  getProjectById,
  getWriteKeyHash,
  upsertEvent,
  getEventsByProject,
  getEventsSince,
} from "@/lib/db/queries";
import { verifyWriteKey } from "@/lib/db/crypto";
import type { PublicEventResponse } from "@/lib/db/types";

type RouteParams = {
  params: Promise<{ publicId: string }>;
};

export async function GET(
  request: NextRequest,
  context: RouteParams
) {
  try {
    const { publicId } = await context.params;
    const searchParams = request.nextUrl.searchParams;
    const before = searchParams.get("before");
    const since = searchParams.get("since");
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "50", 10),
      100
    );

    const project = await getProjectById(publicId);
    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    let events;
    if (since) {
      events = await getEventsSince(publicId, parseInt(since, 10), limit);
    } else {
      events = await getEventsByProject(publicId, {
        before: before ? parseInt(before, 10) : undefined,
        limit,
      });
    }

    const response: PublicEventResponse[] = events.map((e) => ({
      id: e.id,
      timestampMs: Number(e.timestamp_ms),
      caption: e.caption,
      imageUrl: e.image_url,
    }));

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to get events:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  context: RouteParams
) {
  try {
    const { publicId } = await context.params;
    const writeKey = request.headers.get("x-write-key");

    if (!writeKey) {
      return NextResponse.json(
        { error: "Write key is required" },
        { status: 401 }
      );
    }

    const project = await getProjectById(publicId);
    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    const storedHash = await getWriteKeyHash(publicId);
    if (!storedHash || !verifyWriteKey(writeKey, storedHash)) {
      return NextResponse.json(
        { error: "Invalid write key" },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const eventId = formData.get("eventId") as string;
    const timestampMs = formData.get("timestampMs") as string;
    const caption = formData.get("caption") as string | null;
    const file = formData.get("file") as File | null;

    if (!eventId || !timestampMs) {
      return NextResponse.json(
        { error: "eventId and timestampMs are required" },
        { status: 400 }
      );
    }

    if (!file) {
      return NextResponse.json(
        { error: "Image file is required" },
        { status: 400 }
      );
    }

    const extension = file.name.split(".").pop() || "webp";
    const blobPath = `projects/${publicId}/events/${eventId}.${extension}`;

    const blob = await put(blobPath, file, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
    });

    const event = await upsertEvent({
      id: eventId,
      project_id: publicId,
      timestamp_ms: parseInt(timestampMs, 10),
      caption: caption?.trim() || null,
      image_url: blob.url,
    });

    const response: PublicEventResponse = {
      id: event.id,
      timestampMs: Number(event.timestamp_ms),
      caption: event.caption,
      imageUrl: event.image_url,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error("Failed to create event:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
