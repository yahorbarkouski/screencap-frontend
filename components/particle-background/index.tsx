"use client";

import dynamic from "next/dynamic";

export const ParticleBackground = dynamic(
  () => import("./ParticleBackground").then((mod) => mod.ParticleBackground),
  { ssr: false }
);
