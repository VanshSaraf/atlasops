"use client";

import { cn } from "@/lib/utils";
import { APP_TAGLINE } from "@/lib/constants";

interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  className?: string;
}

const SIZES = {
  sm: { box: "h-8 w-8", icon: "h-4 w-4", ring: "h-6 w-6", text: "text-lg" },
  md: { box: "h-10 w-10", icon: "h-5 w-5", ring: "h-7 w-7", text: "text-xl" },
  lg: { box: "h-12 w-12", icon: "h-6 w-6", ring: "h-8 w-8", text: "text-2xl" },
  xl: {
    box: "h-16 w-16",
    icon: "h-8 w-8",
    ring: "h-11 w-11",
    text: "text-3xl",
  },
};

export default function Logo({
  size = "md",
  showText = true,
  className,
}: LogoProps) {
  const s = SIZES[size];

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className={cn("relative flex items-center justify-center", s.box)}>
        <div className="absolute inset-0 rounded-2xl border border-white/10 bg-[linear-gradient(180deg,#163038,#0d1e24)] shadow-[0_14px_30px_rgba(0,0,0,0.26)]" />
        <div className={cn("absolute rounded-xl border border-brand-500/15 bg-brand-500/[0.07]", s.ring)} />
        <svg
          className={cn("relative z-10 text-brand-200", s.icon)}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M12 3L4 7.5V16.5L12 21L20 16.5V7.5L12 3Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="rgba(46,158,135,0.08)"
          />
          <circle
            cx="12"
            cy="12"
            r="3"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="rgba(46,158,135,0.12)"
          />
          <path
            d="M8.5 14.5L12 8L15.5 14.5M9.8 12.2H14.2"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {showText && (
        <div className="flex flex-col leading-none">
          <span className={cn("font-bold tracking-tight text-white", s.text)}>
            Atlas<span className="text-brand-300">Ops</span>
          </span>
          <span className="font-mono text-[10px] font-medium uppercase tracking-[0.24em] text-ink-500">
            {APP_TAGLINE.toUpperCase()}
          </span>
        </div>
      )}
    </div>
  );
}
