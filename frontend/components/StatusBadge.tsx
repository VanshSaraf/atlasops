import { cn } from "@/lib/utils";
import {
  STATUS_COLORS,
  BUG_TYPE_COLORS,
  BUG_TYPE_LABELS,
} from "@/lib/constants";
import type { RunStatus, BugType } from "@/types";

interface StatusBadgeProps {
  status: RunStatus;
  size?: "sm" | "md";
}

export function StatusBadge({ status, size = "sm" }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-mono font-semibold uppercase tracking-[0.18em]",
        STATUS_COLORS[status] || STATUS_COLORS.PENDING,
        size === "sm" ? "px-2.5 py-1 text-[10px]" : "px-3.5 py-1.5 text-[11px]",
      )}
    >
      {status === "RUNNING" && (
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
      )}
      {status}
    </span>
  );
}

interface BugTypeBadgeProps {
  bugType: BugType;
}

export function BugTypeBadge({ bugType }: BugTypeBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.18em]",
        BUG_TYPE_COLORS[bugType] ||
          "bg-white/10 text-ink-300 border-white/10",
      )}
    >
      {BUG_TYPE_LABELS[bugType] || bugType}
    </span>
  );
}
