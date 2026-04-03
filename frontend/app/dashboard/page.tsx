"use client";

import { useAgentStore } from "@/store/useAgentStore";
import {
  StatsGrid,
  RunTriggerForm,
  RunCard,
  RunSummary,
  ScoreBreakdown,
  FixesTable,
  CICDTimeline,
} from "@/components";
import { formatDuration } from "@/lib/utils";

export default function DashboardPage() {
  const { runs, stats, result, isRunning } = useAgentStore();
  const workflowSteps = [
    {
      step: "01",
      label: "Inspect",
      desc: "Map repository and branch context",
    },
    {
      step: "02",
      label: "Reproduce",
      desc: "Replay the failing stage",
    },
    {
      step: "03",
      label: "Diagnose",
      desc: "Convert logs into a root-cause signal",
    },
    {
      step: "04",
      label: "Patch",
      desc: "Draft remediation changes",
    },
    {
      step: "05",
      label: "Validate",
      desc: "Re-run checks against the patch",
    },
    {
      step: "06",
      label: "Export",
      desc: "Preserve zip, artifacts, and review output",
    },
  ];

  return (
    <div className="page-container space-y-8 animate-fade-in">
      <div className="glass-card panel-grid overflow-hidden">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="eyebrow">AtlasOps Console</p>
            <h1 className="mt-3 text-3xl font-bold text-white sm:text-4xl">
              Developer-first recovery control plane
            </h1>
            <p className="mt-3 max-w-xl text-sm text-ink-400">
              Inspect failing pipelines, launch remediation runs, and review fix quality from one clean engineering workspace.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: "Input", value: "GitHub URL / local path" },
              { label: "Engine", value: "multi-pass remediation" },
              { label: "Output", value: "validated fixes + run trace" },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-[22px] border border-white/8 bg-black/10 px-4 py-3"
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-500">
                  {item.label}
                </p>
                <p className="mt-2 font-mono text-xs text-ink-200">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <StatsGrid
        totalRuns={stats.totalRuns}
        passedRuns={stats.passedRuns}
        failedRuns={stats.failedRuns}
        totalFixes={stats.totalFixesApplied}
        averageTime={formatDuration(stats.averageTime)}
      />

      <div className="grid gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-4">
          <div className="glass-card">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-brand-500/20 bg-brand-500/10">
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
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <div>
                <p className="eyebrow">Launcher</p>
                <h2 className="text-lg font-semibold text-white">Start Recovery Run</h2>
                <p className="font-mono text-[11px] text-ink-500">
                  configure repository target + operator context
                </p>
              </div>
            </div>
            <RunTriggerForm />
          </div>
        </div>

        <div className="xl:col-span-8">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="eyebrow">History</p>
              <h2 className="section-title mt-2">Recent Runs</h2>
            </div>
            {isRunning && (
              <span className="inline-flex items-center gap-2 rounded-full border border-brand-500/20 bg-brand-500/10 px-3 py-1 font-mono text-[11px] font-medium text-brand-300">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-400 animate-pulse" />
                Recovery active
              </span>
            )}
          </div>
          {runs.length === 0 ? (
            <div className="glass-card flex flex-col items-center justify-center py-20 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/8 bg-black/10">
                <svg
                  className="h-8 w-8 text-ink-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1}
                    d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
              </div>
              <p className="mt-4 text-sm text-ink-300">No recovery runs yet</p>
              <p className="mt-1 font-mono text-[11px] text-ink-500">
                Add a repository URL and launch a run to populate the workspace
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {runs.map((run) => (
                <RunCard key={run.id} run={run} />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="glass-card">
        <div className="mb-4">
          <p className="eyebrow">Workflow</p>
          <h2 className="mt-2 text-lg font-semibold text-white">Recovery Sequence</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          {workflowSteps.map((item) => (
            <div
              key={item.step}
              className="rounded-[22px] border border-white/8 bg-black/10 px-4 py-4"
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-brand-500/20 bg-brand-500/10 font-mono text-[11px] font-semibold text-brand-300">
                {item.step}
              </span>
              <p className="mt-3 text-sm font-medium text-white">{item.label}</p>
              <p className="mt-1 text-xs text-ink-400">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {result && (
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="eyebrow">Active Analysis</p>
              <h2 className="section-title mt-2">Run Diagnostics Workspace</h2>
            </div>
            <span className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1 font-mono text-[11px] text-ink-400">
              {result.status} · {result.iterations} iteration{result.iterations === 1 ? "" : "s"}
            </span>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="space-y-6">
              <RunSummary run={result} />
              <ScoreBreakdown run={result} />
            </div>

            <div className="space-y-6">
              <CICDTimeline timeline={result.timeline ?? []} retryLimit={5} />
            </div>
          </div>

          <FixesTable fixes={result.fixes ?? []} />
        </section>
      )}
    </div>
  );
}
