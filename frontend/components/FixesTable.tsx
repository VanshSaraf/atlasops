"use client";

import type { FixRecord } from "@/types";
import { BugTypeBadge } from "./StatusBadge";

interface FixesTableProps {
  fixes: FixRecord[];
}

export default function FixesTable({ fixes }: FixesTableProps) {
  const applied = (fixes ?? []).filter((f) => f.fixApplied).length;

  return (
    <div className="glass-card animate-slide-up space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/8 bg-brand-500/10">
            <svg
              className="h-5 w-5 text-brand-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Fixes Applied</h2>
            <p className="text-xs text-ink-500">
              {applied}/{fixes.length} fixes successfully applied
            </p>
          </div>
        </div>
        <span className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-1 text-xs font-medium text-ink-300 tabular-nums">
          {fixes.length} total
        </span>
      </div>

      {fixes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <svg
            className="h-10 w-10 text-ink-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="mt-3 text-sm text-ink-400">No fixes recorded</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[22px] border border-white/8 bg-black/10">
          <div className="overflow-x-auto">
            <table className="min-w-full table-fixed border-separate border-spacing-y-0">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-500">
                    File
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-500">
                    Bug Type
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-500">
                    Line
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-500">
                    Error
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-500">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {fixes.map((fix, idx) => (
                  <tr
                    key={idx}
                    className="group border-t border-white/8 bg-transparent transition-colors hover:bg-white/[0.03]"
                  >
                    <td className="px-4 py-4 align-top">
                      <span className="block break-all font-mono text-xs leading-relaxed text-brand-300">
                        {fix.file}
                      </span>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <BugTypeBadge bugType={fix.bugType} />
                    </td>
                    <td className="px-4 py-4 align-top">
                      <span className="font-mono text-xs text-ink-300 tabular-nums">
                        {fix.line > 0 ? fix.line : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <p
                        className="line-clamp-3 break-words text-xs leading-relaxed text-ink-300"
                        title={fix.error}
                      >
                        {fix.error}
                      </p>
                    </td>
                    <td className="px-4 py-4 align-top">
                      {fix.fixApplied ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/12 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-300">
                          <svg
                            className="h-3.5 w-3.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2.5}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                          Fixed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/25 bg-red-500/12 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-red-300">
                          <svg
                            className="h-3.5 w-3.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2.5}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                          Failed
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
