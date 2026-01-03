"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ParticleBackground } from "@/components/particle-background";

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

export default function Home() {
  return (
    <div className="relative min-h-screen min-h-dvh bg-background">
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

      <div className="relative z-10 p-2 sm:p-4 lg:p-6">
        <motion.header
          className="flex items-center gap-10 px-4 py-6 sm:px-8 sm:py-8 lg:px-32"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          <motion.div 
            className="text-xl text-white cursor-default"
            whileHover={{ 
              textShadow: "0 0 10px rgba(212, 168, 75, 0.8), 0 0 20px rgba(212, 168, 75, 0.5)" 
            }}
            transition={{ duration: 0.3 }}
          >
            Screencap
          </motion.div>
        </motion.header>

        <main className="px-4 py-6 sm:p-8 lg:p-12 lg:px-32">
          <div className="max-w-3xl">
            <motion.h1
              className="mb-8 text-[1.75rem] leading-[1.15] tracking-tight text-gray-200 sm:mb-12 sm:text-[2.25rem] md:mb-16 md:text-5xl"
              initial={enterInitial}
              animate={enterAnimate}
              transition={enterTransition(0)}
            >
              Share your project progress with the world.
            </motion.h1>

            <div className="space-y-6 text-[15px] leading-[1.7] text-zinc-300 sm:space-y-8 sm:text-[17px]">
              <motion.p
                initial={enterInitial}
                animate={enterAnimate}
                transition={enterTransition(0.15)}
              >
                Screencap captures your development milestones and lets you share them publicly.
                Each project gets a unique link where your progress is streamed in real-time.
              </motion.p>

              <motion.p
                initial={enterInitial}
                animate={enterAnimate}
                transition={enterTransition(0.3)}
              >
                No accounts needed. Just enable sharing in the desktop app and your
                progress updates will appear on your public page automatically.
              </motion.p>
            </div>

            <motion.div
              className="mt-12 sm:mt-16 lg:mt-20"
              initial={enterInitial}
              animate={enterAnimate}
              transition={enterTransition(0.45)}
            >
              <Link
                href="https://screencap.app"
                className="inline-flex items-center gap-2 rounded-lg border border-gold/30 bg-gold/10 px-6 py-3 text-sm font-medium text-gold transition-colors hover:bg-gold/20 hover:border-gold/50"
              >
                Download Screencap
                <span className="text-gold/70">→</span>
              </Link>
            </motion.div>
          </div>
        </main>
      </div>
    </div>
  );
}
