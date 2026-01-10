"use client";

import { motion } from "framer-motion";
import { useEffect, useState, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";

const COLS = 48;
const ROWS = 12;
const TOTAL_SLOTS = COLS * ROWS;

type Category = "Study" | "Work" | "Leisure" | "Chores" | "Social" | "Unknown" | "Text";
type SlotData = {
  intensity: number;
  category: Category;
  active: boolean;
  hidden?: boolean;
};

const CATEGORY_COLORS: Record<Category, string> = {
  Study: "rgb(59, 130, 246)",
  Work: "rgb(34, 197, 94)",
  Leisure: "rgb(168, 85, 247)",
  Chores: "rgb(250, 204, 21)",
  Social: "rgb(236, 72, 153)",
  Unknown: "rgb(107, 114, 128)",
  Text: "var(--color-gold)", 
};

const FONT: Record<string, number[][]> = {
  S: [[1,1,1],[1,0,0],[1,1,1],[0,0,1],[1,1,1]],
  C: [[1,1,1],[1,0,0],[1,0,0],[1,0,0],[1,1,1]],
  R: [[1,1,0],[1,0,1],[1,1,0],[1,0,1],[1,0,1]],
  E: [[1,1,1],[1,0,0],[1,1,0],[1,0,0],[1,1,1]],
  N: [[1,1,1],[1,0,1],[1,0,1],[1,0,1],[1,0,1]],
  A: [[1,1,1],[1,0,1],[1,1,1],[1,0,1],[1,0,1]],
  P: [[1,1,0],[1,0,1],[1,1,0],[1,0,0],[1,0,0]],
};

const TEXT_CHARS = ['S', 'C', 'R', 'E', 'E', 'N', 'C', 'A', 'P'];

function generateTextPattern(): SlotData[] {
  const slots: SlotData[] = Array(TOTAL_SLOTS).fill({ intensity: 0, category: "Unknown", active: false });
  const startCol = 7;
  const startRow = Math.floor((ROWS - 5) / 2);

  let currentCol = startCol;

  TEXT_CHARS.forEach(char => {
    const pattern = FONT[char];
    if (!pattern) return;

    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 3; c++) {
        if (pattern[r][c] === 1) {
          const gridRow = startRow + r;
          const gridCol = currentCol + c;
          const idx = gridRow * COLS + gridCol;
          if (idx < TOTAL_SLOTS) {
            slots[idx] = { 
              intensity: 4, 
              category: "Text", 
              active: true 
            };
          }
        }
      }
    }
    currentCol += 4;
  });

  return slots;
}

function generateDayPattern(): SlotData[] {
  const slots: SlotData[] = new Array(TOTAL_SLOTS).fill(null);
  
  for (let c = 0; c < COLS; c++) {
    const hour = Math.floor(c / 2);
    
    // Before 6 AM - empty slots only (no activity)
    if (hour < 6) {
      for (let r = 0; r < ROWS; r++) {
        const idx = r * COLS + c;
        slots[idx] = {
          intensity: 0,
          category: "Unknown",
          active: false
        };
      }
      continue;
    }
    
    let categoryWeights: Partial<Record<Category, number>> = {};
    let baseIntensity = 0;
    let activityChance = 0;

    if (hour < 9) {
      categoryWeights = { Chores: 0.6, Social: 0.4 };
      activityChance = 0.4;
      baseIntensity = 2;
    } else if (hour < 12) {
      categoryWeights = { Work: 0.8, Study: 0.2 };
      activityChance = 0.9;
      baseIntensity = 4;
    } else if (hour < 13) {
      categoryWeights = { Leisure: 0.7, Social: 0.3 };
      activityChance = 0.5;
      baseIntensity = 2;
    } else if (hour < 18) {
      categoryWeights = { Work: 0.7, Social: 0.2, Study: 0.1 };
      activityChance = 0.85;
      baseIntensity = 3;
    } else if (hour < 20) {
      categoryWeights = { Leisure: 0.5, Chores: 0.3, Social: 0.2 };
      activityChance = 0.6;
      baseIntensity = 2;
    } else {
      categoryWeights = { Leisure: 0.8, Social: 0.2 };
      activityChance = 0.4;
      baseIntensity = 2;
    }

    for (let r = 0; r < ROWS; r++) {
      const idx = r * COLS + c;
      
      if (Math.random() < activityChance) {
        const rand = Math.random();
        let cumulative = 0;
        let selectedCat: Category = "Unknown";
        
        const entries = Object.entries(categoryWeights);
        for (const [cat, weight] of entries) {
          cumulative += weight;
          if (rand <= cumulative) {
            selectedCat = cat as Category;
            break;
          }
        }
        
        const intensity = Math.min(4, Math.max(1, baseIntensity + (Math.random() > 0.5 ? 1 : -1)));
        
        slots[idx] = {
          intensity,
          category: selectedCat,
          active: true
        };
      } else {
        slots[idx] = {
          intensity: 0,
          category: "Unknown",
          active: false
        };
      }
    }
  }
  return slots;
}

export function DaylineHero({ className }: { className?: string }) {
  const [mode, setMode] = useState<"text" | "day">("text");
  const [data, setData] = useState<SlotData[]>([]);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const hasTransitioned = useRef(false);

  const textPattern = useMemo(() => generateTextPattern(), []);
  const dayPattern = useMemo(() => generateDayPattern(), []);
  
  const dayDelays = useMemo(() => {
    return Array.from({ length: TOTAL_SLOTS }).map((_, idx) => {
      const col = idx % COLS;
      return col * 0.012;
    });
  }, []);

  useEffect(() => {
    setMounted(true);
    setData(textPattern);
    const timer = setTimeout(() => {
      hasTransitioned.current = true;
      setMode("day");
      setData(dayPattern);
    }, 2500);
    return () => clearTimeout(timer);
  }, [textPattern, dayPattern]);
  
  if (!mounted) return <div className={cn("h-[220px] w-full", className)} />;

  return (
    <div 
      className={cn("w-full select-none flex flex-col gap-2", className)}
      onMouseLeave={() => setHoveredIdx(null)}
    >
      <div
        className="grid gap-[2px] sm:gap-[3px] md:gap-[4px]"
        style={{ 
          gridTemplateColumns: `repeat(${COLS}, 1fr)`,
        }}
      >
        {Array.from({ length: TOTAL_SLOTS }).map((_, idx) => {
          const cell = data[idx] || { intensity: 0, category: "Unknown", active: false };
          
          const row = Math.floor(idx / COLS);
          const col = idx % COLS;
          
          const entranceDelay = col * 0.02 + row * 0.04;
          const transitionDelay = dayDelays[idx];

          return (
            <Slot 
              key={idx}
              data={cell}
              entranceDelay={entranceDelay}
              transitionDelay={transitionDelay}
              hasTransitioned={hasTransitioned.current}
              isHovered={hoveredIdx === idx}
              onHover={() => setHoveredIdx(idx)}
            />
          );
        })}
      </div>

      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: mode === "day" ? 1 : 0 }}
        transition={{ duration: 1, delay: 0.5 }}
        className="flex justify-between px-1 text-[10px] font-mono text-muted-foreground/50 uppercase tracking-widest"
      >
        <span>00:00</span>
        <span>06:00</span>
        <span>12:00</span>
        <span>18:00</span>
        <span>24:00</span>
      </motion.div>
    </div>
  );
}

function Slot({ 
  data, 
  entranceDelay,
  transitionDelay,
  hasTransitioned,
  isHovered, 
  onHover 
}: { 
  data: SlotData; 
  entranceDelay: number;
  transitionDelay: number;
  hasTransitioned: boolean;
  isHovered: boolean;
  onHover: () => void;
}) {
  const { intensity, category, active, hidden } = data;
  const hasAnimated = useRef(false);

  const color = useMemo(() => {
    if (hidden) return "transparent";
    if (!active || intensity === 0) return "rgba(255,255,255,0.03)";
    return CATEGORY_COLORS[category];
  }, [active, intensity, category, hidden]);

  const visualOpacity = useMemo(() => {
    if (hidden) return 0;
    if (!active || intensity === 0) return 1;
    return 0.3 + (intensity / 4) * 0.7;
  }, [active, intensity, hidden]);

  const shouldPulse = useMemo(() => intensity >= 3 && hasTransitioned && Math.random() > 0.7, [intensity, hasTransitioned]);
  const pulseDuration = useMemo(() => 2 + Math.random() * 3, []);

  useEffect(() => {
    if (!hasAnimated.current) {
      hasAnimated.current = true;
    }
  }, []);

  const isFirstRender = !hasAnimated.current;

  return (
    <motion.div
      initial={isFirstRender ? { opacity: 0, scale: 0, backgroundColor: color } : false}
      animate={{ 
        opacity: isHovered ? 1 : visualOpacity, 
        scale: 1,
        backgroundColor: isHovered ? "var(--color-foreground)" : color,
      }}
      transition={{
        scale: {
          duration: 0.6,
          delay: isFirstRender ? entranceDelay : 0,
          type: "spring",
          stiffness: 120,
          damping: 14
        },
        opacity: {
          duration: hasTransitioned ? 0.5 : 0.4,
          delay: isFirstRender ? entranceDelay : transitionDelay,
        },
        backgroundColor: {
          duration: 0.4,
          delay: isFirstRender ? entranceDelay : transitionDelay,
        }
      }}
      whileHover={!hidden ? { scale: 1.4, zIndex: 20, transition: { duration: 0.1 } } : undefined}
      onMouseEnter={!hidden ? onHover : undefined}
      className="aspect-square rounded-[1px] sm:rounded-[2px] relative overflow-hidden"
    >
      {shouldPulse && (
        <motion.div
          className="absolute inset-0 bg-white/30"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.5, 0] }}
          transition={{
            duration: pulseDuration,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1 + Math.random() * 2
          }}
        />
      )}
    </motion.div>
  );
}
