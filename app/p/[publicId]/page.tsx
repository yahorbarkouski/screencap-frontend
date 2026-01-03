import { notFound } from "next/navigation";
import { getProjectById, getEventsByProject } from "@/lib/db/queries";
import { PublicProgressView } from "@/components/progress/PublicProgressView";
import type { PublicProjectResponse, PublicEventResponse } from "@/lib/db/types";
import type { Metadata } from "next";

type PageProps = {
  params: Promise<{ publicId: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { publicId } = await params;

  try {
    const project = await getProjectById(publicId);
    if (!project) {
      return { title: "Project not found" };
    }
    return {
      title: `${project.name} - Progress`,
      description: `Project progress timeline for ${project.name}`,
    };
  } catch {
    return { title: "Project Progress" };
  }
}

export default async function PublicProgressPage({ params }: PageProps) {
  const { publicId } = await params;

  let project;
  let events;

  try {
    project = await getProjectById(publicId);
    if (!project) {
      notFound();
    }

    events = await getEventsByProject(publicId, { limit: 100 });
  } catch (error) {
    console.error("Failed to load project:", error);
    notFound();
  }

  const projectResponse: PublicProjectResponse = {
    id: project.id,
    name: project.name,
    lastEventAt: project.last_event_at
      ? new Date(project.last_event_at).getTime()
      : null,
  };

  const eventsResponse: PublicEventResponse[] = events.map((e) => ({
    id: e.id,
    timestampMs: Number(e.timestamp_ms),
    caption: e.caption,
    imageUrl: e.image_url,
  }));

  return (
    <div className="relative min-h-screen bg-background">
      <div className="pointer-events-none fixed inset-0 h-full w-full opacity-[0.03]">
        <svg className="h-full w-full">
          <filter id="noise">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.8"
              numOctaves="4"
              stitchTiles="stitch"
            />
          </filter>
          <rect width="100%" height="100%" filter="url(#noise)" />
        </svg>
      </div>

      <div className="relative z-10">
        <PublicProgressView
          project={projectResponse}
          initialEvents={eventsResponse}
        />
      </div>
    </div>
  );
}
