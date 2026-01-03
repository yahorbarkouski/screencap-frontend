"use client";

import { useState, ReactNode } from "react";
import { BengalEnd } from "@/components/bengal-end";

interface SparkleLinkProps {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  className?: string;
}

export function SparkleLink({ children, href, onClick, className = "" }: SparkleLinkProps) {
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (href) {
      window.location.href = href;
    }
  };

  return (
    <button
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`relative inline-flex cursor-pointer items-center border-none bg-transparent outline-none ${className}`}
    >
      <div className="absolute -left-3 top-1/2 -translate-y-1/2">
        <BengalEnd isActive={isHovered} isConnecting={false} />
      </div>

      <span className="relative">{children}</span>

      <div className="absolute -right-3 top-1/2 -translate-y-1/2">
        <BengalEnd isActive={isHovered} isConnecting={false} />
      </div>
    </button>
  );
}
