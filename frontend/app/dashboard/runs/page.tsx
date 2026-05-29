"use client";

import { useEffect } from "react";
import { useAgentStore } from "@/store/useAgentStore";
import { RunCard, LoadingSpinner } from "@/components";
import { StatusBadge } from "@/components/StatusBadge";
import { successRate } from "@/lib/utils";

export default function RunsPage() {
  const { runs, stats, isRunning, isLoadingHistory, historyError, loadRuns } =
    useAgentStore();

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  return (
    <div className="page-container space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Recovery Runs</h1>
          <p className="mt-1 text-sm text-ink-400">
            {runs.length} total runs &middot;{" "}
            {successRate(stats.passedRuns, stats.totalRuns)} success rate
          </p>
        </div>
        {isRunning && (
          <div className="flex items-center gap-2 rounded-full border border-brand-500/20 bg-brand-500/10 px-3 py-1.5 text-sm text-brand-300">
            <LoadingSpinner size="sm" />
            Recovery running...
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterChip label="All" count={runs.length} active />
        <FilterChip
          label="Passed"
          count={runs.filter((r) => r.status === "PASSED").length}
        />
        <FilterChip
          label="Failed"
          count={runs.filter((r) => r.status === "FAILED").length}
        />
      </div>

      {isLoadingHistory ? (
        <div className="card flex flex-col items-center justify-center py-20 text-center">
          <LoadingSpinner />
          <p className="mt-4 text-ink-400">Loading previous runs...</p>
        </div>
      ) : historyError ? (
        <div className="card flex flex-col items-center justify-center py-20 text-center">
          <p className="text-red-300">Could not load run history. Backend may be unavailable.</p>
          <p className="mt-2 max-w-md text-xs text-ink-500">
            Artifact-backed history may also disappear on free or ephemeral hosting.
          </p>
        </div>
      ) : runs.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-20 text-center">
          <svg
            className="h-16 w-16 text-ink-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
          <p className="mt-4 text-ink-400">No runs yet. Launch a repo analysis to create your first run.</p>
          <p className="mt-1 text-xs text-ink-500">
            Go to Dashboard to trigger a recovery run
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {runs.map((run) => (
            <RunCard key={run.id} run={run} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  label,
  count,
  active = false,
}: {
  label: string;
  count: number;
  active?: boolean;
}) {
  return (
    <button
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] transition-colors ${
        active
          ? "border-brand-500/25 bg-brand-500/12 text-brand-300"
          : "border-white/8 bg-white/[0.03] text-ink-400 hover:border-brand-500/20"
      }`}
    >
      {label}
      <span className="rounded-full bg-surface px-1.5 py-0.5 text-[10px] text-ink-300">
        {count}
      </span>
    </button>
  );
}
