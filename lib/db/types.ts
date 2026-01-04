export interface PublishedProject {
  id: string;
  name: string;
  created_at: Date;
  updated_at: Date;
  last_event_at: Date | null;
}

export interface PublishedProjectEvent {
  id: string;
  project_id: string;
  timestamp_ms: number;
  caption: string | null;
  image_url: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateProjectResponse {
  publicId: string;
  writeKey: string;
  shareUrl: string;
}

export interface PublicProjectResponse {
  id: string;
  name: string;
  lastEventAt: number | null;
}

export interface PublicEventResponse {
  id: string;
  timestampMs: number;
  payloadCiphertext: string;
  imageUrl: string | null;
}
