"use client";

import Link from "next/link";
import type { AgentRun } from "@/types";
import { StatusBadge } from "./StatusBadge";
import {
  formatDuration,
  formatRelativeTime,
  extractRepoName,
} from "@/lib/utils";

interface RunCardProps {
  run: AgentRun;
}

export default function RunCard({ run }: RunCardProps) {
  const latestDetail = [...(run.timeline ?? [])]
    .reverse()
    .find((entry) => entry.detail)?.detail;

  return (
    <Link
      href={`/dashboard/runs/${run.id}`}
      className="group block rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(17,28,32,0.98),rgba(12,21,24,0.98))] p-5 shadow-[0_18px_45px_rgba(0,0,0,0.22)] transition-all hover:-translate-y-1 hover:border-brand-500/20 hover:bg-[#142126]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded-full border border-white/8 bg-white/[0.03] px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-ink-400">
              Recovery Run
            </span>
          </div>
          <h3 className="truncate text-base font-semibold text-white transition-colors group-hover:text-brand-300">
            {extractRepoName(run.repository)}
          </h3>
          <p className="mt-1 truncate font-mono text-[11px] text-ink-500">
            {run.repository}
          </p>
        </div>
        <StatusBadge status={run.status} />
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3 rounded-[22px] border border-white/6 bg-black/10 p-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.16em] text-ink-500">Failures</p>
          <p className="mt-1 font-mono text-lg font-semibold text-white">
            {run.totalFailures}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.16em] text-ink-500">Fixes</p>
          <p className="mt-1 font-mono text-lg font-semibold text-emerald-300">
            {run.totalFixes}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.16em] text-ink-500">Iterations</p>
          <p className="mt-1 font-mono text-lg font-semibold text-white">
            {run.iterations}
          </p>
        </div>
      </div>

      <div className="mt-4 border-t border-white/8 pt-4">
        {latestDetail ? (
          <p className="mb-3 line-clamp-2 text-xs text-ink-400">{latestDetail}</p>
        ) : null}
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] text-ink-500">
            {formatDuration(run.timeTaken)}
          </span>
          <span className="font-mono text-[11px] text-ink-500">
            {formatRelativeTime(run.createdAt)}
          </span>
        </div>
      </div>
    </Link>
  );
}
