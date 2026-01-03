import { NextRequest, NextResponse } from "next/server";
import { getProjectById } from "@/lib/db/queries";
import type { PublicProjectResponse } from "@/lib/db/types";

type RouteParams = {
  params: Promise<{ publicId: string }>;
};

export async function GET(
  _request: NextRequest,
  context: RouteParams
) {
  try {
    const { publicId } = await context.params;
    const project = await getProjectById(publicId);

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    const response: PublicProjectResponse = {
      id: project.id,
      name: project.name,
      lastEventAt: project.last_event_at
        ? new Date(project.last_event_at).getTime()
        : null,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to get project:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
