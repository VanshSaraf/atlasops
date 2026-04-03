import type { FixRecord } from "@/types";
import { BugTypeBadge } from "./StatusBadge";

interface FailureListProps {
  failures: string[];
}

export function FormattedFailureList({ failures }: FailureListProps) {
  if (failures.length === 0) return null;

  return (
    <div className="space-y-2">
      {failures.map((line, idx) => (
        <div
          key={idx}
          className="rounded-[20px] border border-white/8 bg-white/[0.03] px-4 py-3 font-mono text-xs leading-relaxed text-ink-200"
        >
          {line}
        </div>
      ))}
    </div>
  );
}

interface FixListProps {
  fixes: FixRecord[];
}

export function FixList({ fixes }: FixListProps) {
  if (fixes.length === 0) return null;

  return (
    <div className="space-y-2">
      {fixes.map((fix, idx) => (
        <div
          key={idx}
          className="rounded-[20px] border border-white/8 bg-white/[0.03] p-4"
        >
          <div className="flex items-center gap-2">
            <BugTypeBadge bugType={fix.bugType} />
            <span className="text-xs text-ink-500">
              {fix.fixApplied ? "Applied" : "Not applied"}
            </span>
            {fix.fixApplied && (
              <svg
                className="h-4 w-4 text-emerald-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            )}
          </div>
          <p className="mt-2 font-mono text-xs text-ink-200">
            <span className="text-brand-300">{fix.file}</span>
            {fix.line > 0 && <span className="text-ink-500">:{fix.line}</span>}
          </p>
          <p className="mt-1 text-xs text-ink-400">{fix.error}</p>
        </div>
      ))}
    </div>
  );
}
