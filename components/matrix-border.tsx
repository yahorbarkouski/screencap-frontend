"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface MatrixBorderProps {
  children: React.ReactNode;
  active?: boolean;
  className?: string;
  speed?: number;
  baseSpeed?: number;
}

export function MatrixBorder({
  children,
  active = false,
  className,
  speed = 50,
  baseSpeed = 150,
}: MatrixBorderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<{ top: string; bottom: string; left: string; right: string }>({
    top: "",
    bottom: "",
    left: "",
    right: "",
  });
  
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%*+=-?;";
  const words = ["PROGRESS", "BUILD", "SHIP", "CREATE", "CAPTURE", "MILESTONE", "DEVELOP", "CODE", "DESIGN"];

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const calculateChars = () => {
      const { width, height } = container.getBoundingClientRect();
      const charWidth = 3.6; 
      const charHeight = 6;

      const cols = Math.ceil(width / charWidth) + 4;
      const rows = Math.ceil(height / charHeight) + 4;

      return { cols, rows };
    };

    const generateLine = (length: number) => {
      let line = "";
      while (line.length < length) {
        if (Math.random() < 0.1) {
          const word = words[Math.floor(Math.random() * words.length)];
          if (line.length + word.length <= length) {
            line += word;
            continue;
          }
        }
        line += chars[Math.floor(Math.random() * chars.length)];
      }
      return line;
    };

    const updateLines = () => {
      const { cols, rows } = calculateChars();
      setLines({
        top: generateLine(cols),
        bottom: generateLine(cols),
        left: generateLine(rows),
        right: generateLine(rows),
      });
    };

    updateLines();

    const observer = new ResizeObserver(updateLines);
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const currentSpeed = active ? speed : baseSpeed;

    const interval = setInterval(() => {
      setLines((prev) => {
        const updateString = (str: string) => {
          const arr = str.split("");
          const changes = Math.max(1, Math.floor(arr.length * (active ? 0.15 : 0.03)));
          
          for (let i = 0; i < changes; i++) {
            const idx = Math.floor(Math.random() * arr.length);
            arr[idx] = chars[Math.floor(Math.random() * chars.length)];
          }

          if (Math.random() < (active ? 0.2 : 0.05)) {
            const word = words[Math.floor(Math.random() * words.length)];
            if (arr.length >= word.length) {
                const pos = Math.floor(Math.random() * (arr.length - word.length));
                for (let i = 0; i < word.length; i++) {
                arr[pos + i] = word[i];
                }
            }
          }

          return arr.join("");
        };

        return {
          top: updateString(prev.top),
          bottom: updateString(prev.bottom),
          left: updateString(prev.left),
          right: updateString(prev.right),
        };
      });
    }, currentSpeed);

    return () => clearInterval(interval);
  }, [active, speed, baseSpeed]);

  return (
    <div ref={containerRef} className={cn("relative group w-full rounded-xl overflow-hidden", className)}>
      <div className={cn(
        "absolute top-0 left-0 right-0 h-[8px] overflow-hidden whitespace-nowrap text-[6px] leading-[1] font-mono select-none pointer-events-none transition-colors duration-300",
        "text-zinc-600 group-hover:text-gray-200"
      )}>
        {lines.top}
      </div>
      
      <div className={cn(
        "absolute top-2 bottom-2 left-0 w-[8px] overflow-hidden text-[6px] leading-[1] font-mono select-none pointer-events-none flex flex-col items-center break-all transition-colors duration-300 justify-center",
        "text-zinc-600 group-hover:text-gray-200"
      )}>
        {lines.left.split("").map((c, i) => <span key={i}>{c}</span>)}
      </div>

      {children}
      
      <div className={cn(
        "absolute top-2 bottom-2 right-0 w-[8px] overflow-hidden text-[6px] leading-[1] font-mono select-none pointer-events-none flex flex-col items-center break-all transition-colors duration-300 justify-center",
        "text-zinc-600 group-hover:text-gray-200"
      )}>
        {lines.right.split("").map((c, i) => <span key={i}>{c}</span>)}
      </div>

      <div className={cn(
        "absolute bottom-0 left-1 right-1 h-[8px] overflow-hidden whitespace-nowrap text-[6px] leading-[1] font-mono select-none pointer-events-none transition-colors duration-300",
        "text-zinc-600 group-hover:text-gray-200"
      )}>
        {lines.bottom}
      </div>
    </div>
  );
}
