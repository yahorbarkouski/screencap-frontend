"use client";

import { motion, useAnimationControls } from "framer-motion";
import { useEffect } from "react";

const rays = [
  { a: -8, l: 9.5, w: 1.1, d: 0 },
  { a: 28, l: 7.8, w: 0.9, d: 0.04 },
  { a: 52, l: 8.6, w: 1.0, d: 0.08 },
  { a: 88, l: 9.2, w: 1.1, d: 0.02 },
  { a: 118, l: 7.5, w: 0.85, d: 0.1 },
  { a: 155, l: 9.0, w: 1.0, d: 0.06 },
  { a: 182, l: 7.2, w: 0.9, d: 0.12 },
  { a: 215, l: 8.8, w: 0.95, d: 0.03 },
  { a: 248, l: 8.0, w: 0.9, d: 0.09 },
  { a: 278, l: 9.3, w: 1.1, d: 0.01 },
  { a: 312, l: 7.4, w: 0.85, d: 0.07 },
  { a: 342, l: 8.4, w: 0.95, d: 0.05 },
] as const;

interface BengalEndProps {
  isActive: boolean;
  isConnecting: boolean;
}

export function BengalEnd({ isActive, isConnecting }: BengalEndProps) {
  const controls = useAnimationControls();
  const active = isActive && !isConnecting;

  useEffect(() => {
    if (active) {
      controls.start("flicker");
    } else {
      controls.start("hidden");
    }
  }, [active, controls]);

  return (
    <motion.svg
      width={22}
      height={22}
      viewBox="0 0 22 22"
      className="block"
      style={{ overflow: "visible", margin: "0 -11px" }}
      initial={{ opacity: 0 }}
      animate={isActive ? { opacity: 1 } : { opacity: 0 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
    >
      <defs>
        <filter id="bengal-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="0.6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g filter="url(#bengal-glow)">
        {rays.map((ray, i) => {
          const rad = (ray.a * Math.PI) / 180;
          const x2 = 11 + Math.cos(rad) * ray.l;
          const y2 = 11 + Math.sin(rad) * ray.l;

          return (
            <motion.line
              key={i}
              x1={11}
              y1={11}
              x2={x2}
              y2={y2}
              stroke="#d4a84b"
              strokeWidth={ray.w}
              strokeLinecap="round"
              variants={{
                hidden: {
                  opacity: 0,
                  pathLength: 0,
                },
                flicker: {
                  opacity: [0.35, 0.95, 0.5, 0.9, 0.4, 0.85, 0.35],
                  pathLength: [0.55, 1, 0.7, 0.95, 0.6, 0.9, 0.55],
                },
              }}
              initial="hidden"
              animate={controls}
              transition={{
                duration: 0.9 + i * 0.06,
                delay: ray.d,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          );
        })}
      </g>
    </motion.svg>
  );
}
