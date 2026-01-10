"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ParticleBackground } from "@/components/particle-background";
import { AsciiLogo } from "@/components/ascii-logo";
import { AppleIcon, GithubIcon } from "lucide-react";

const enterInitial = {
  opacity: 0,
  filter: "blur(5px)",
  y: 8,
};

const enterAnimate = {
  opacity: 1,
  filter: "blur(0px)",
  y: 0,
};

const enterTransition = (delay: number) => ({
  duration: 0.6,
  ease: [0.25, 0.1, 0.25, 1] as const,
  delay,
});

type ReleaseAsset = {
  name: string;
  browser_download_url: string;
};

type ReleaseResponse = {
  assets: ReleaseAsset[];
};

async function downloadLatest() {
  const isAppleSilicon = (() => {
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl");
      const debugInfo = gl?.getExtension("WEBGL_debug_renderer_info");
      if (debugInfo) {
        const renderer = gl?.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        if (renderer?.includes("Apple M")) return true;
      }
    } catch {
      // ignore
    }
    return false;
  })();

  const arch = isAppleSilicon ? "arm64" : "x64";

  const res = await fetch(
    "https://api.github.com/repos/yahorbarkouski/screencap/releases/latest"
  );
  const data: ReleaseResponse = await res.json();

  const dmg = data.assets.find(
    (a) => a.name.endsWith(".dmg") && a.name.includes(arch)
  );

  if (dmg) {
    window.location.href = dmg.browser_download_url;
  } else {
    window.location.href =
      "https://github.com/yahorbarkouski/screencap/releases/latest";
  }
}

export default function Home() {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadLatest();
    } finally {
      setDownloading(false);
    }
  };
  return (
    <div className="relative min-h-dvh bg-background">
      <ParticleBackground />

      <div className="fixed inset-0 h-dvh w-full bg-black/45" />

      <div className="pointer-events-none fixed inset-0 h-dvh w-full opacity-[0.04]">
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

      <div className="relative z-10 flex min-h-dvh flex-col">

        <main className="flex flex-1 flex-col items-center px-4 pb-8 sm:pb-16">
          <div className="w-full max-w-4xl text-center pt-16 sm:pt-24 md:pt-32">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8 }}
              className="-mb-4 sm:-mb-6 md:-mb-10 md:-ml-44 -ml-20"
            >
              <AsciiLogo />
            </motion.div>

            <motion.p
              className="mx-auto mb-8 max-w-[600px] px-2 text-[14px] leading-[1.7] text-gray-200 sm:mb-12 sm:px-0 sm:text-[15px] md:mb-14 md:text-[16px]"
              initial={enterInitial}
              animate={enterAnimate}
              transition={enterTransition(0.3)}
            >
              Capture screenshots with context on schedule, classify with LLM, and
              transform them into timelines, daily summaries, project
              milestones, and addiction tracking, then share with friends
            </motion.p>

            <motion.div
              className="flex flex-col items-center gap-3 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-4"
              initial={enterInitial}
              animate={enterAnimate}
              transition={enterTransition(0.4)}
            >
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gold/30 bg-gold/10 px-6 py-3 text-sm font-medium text-gold transition-colors hover:cursor-pointer hover:border-gold/50 hover:bg-gold/20 disabled:opacity-50 sm:w-auto"
              >
                {downloading ? "Downloading..." : "Download"}
                <span className="text-gold/70">↓</span>
              </button>
              <Link
                href="https://github.com/yahorbarkouski/screencap"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center gap-1 rounded-lg border border-zinc-700 px-6 py-3 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white sm:w-auto"
              >
                <GithubIcon className="h-4 w-4" />
                GitHub
                <span className="ml-1 text-zinc-400">→</span>
              </Link>
            </motion.div>
          </div>
        </main>
      </div>
    </div>
  );
}
