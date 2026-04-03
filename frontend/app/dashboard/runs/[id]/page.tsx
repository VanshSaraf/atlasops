"use client";

import { useParams, useRouter } from "next/navigation";
import { useAgentStore } from "@/store/useAgentStore";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDuration, formatDate, extractRepoName } from "@/lib/utils";
import { getAgentRunDownloadUrl } from "@/lib/api";

export default function RunDetailPage() {
  const params = useParams();
  const router = useRouter();
  const runs = useAgentStore((s) => s.runs);
  const run = runs.find((r) => r.id === params.id);

  if (!run) {
    return (
      <div className="page-container animate-fade-in">
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-surface-overlay">
            <svg
              className="h-10 w-10 text-ink-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h2 className="mt-6 text-xl font-semibold text-white">
            Run Not Found
          </h2>
          <p className="mt-2 text-sm text-ink-400">
            This run may have been deleted or doesn&apos;t exist.
          </p>
          <button
            onClick={() => router.push("/dashboard/runs")}
            className="mt-6 rounded-xl bg-brand-500 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-400"
          >
            ← Back to Runs
          </button>
        </div>
      </div>
    );
  }

  const outcomeScore = run.status === "PASSED" ? 100 : 0;
  const remediationCoverage =
    run.totalFailures > 0
      ? Math.round((run.totalFixes / run.totalFailures) * 100)
      : 0;
  const setupIssue = run.timeline.find((entry) => entry.event === "SETUP_ERROR");
  const downloadUrl = run.artifact?.downloadPath
    ? getAgentRunDownloadUrl(run.id)
    : null;
  const failureDetails = run.failureDetails;
  const changedFiles = Array.from(new Set(run.fixes.filter((fix) => fix.fixApplied).map((fix) => fix.file)));

  return (
    <div className="page-container space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button
          onClick={() => router.push("/dashboard/runs")}
          className="mt-1 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.03] text-ink-400 transition-colors hover:border-brand-500/20 hover:text-white"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">
              {extractRepoName(run.repository)}
            </h1>
            <StatusBadge status={run.status} size="md" />
          </div>
          <a
            href={run.repository}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1.5 text-sm text-ink-400 transition-colors hover:text-brand-300"
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            {run.repository}
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </a>
        </div>
        {downloadUrl ? (
          <a
            href={downloadUrl}
            className="inline-flex items-center gap-2 rounded-2xl border border-brand-500/20 bg-brand-500/10 px-4 py-2.5 text-sm font-semibold text-brand-300 transition-colors hover:bg-brand-500/15 hover:text-white"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M12 16V4m0 12l-4-4m4 4l4-4M4 20h16"
              />
            </svg>
            Download Patched Zip
          </a>
        ) : null}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          icon={
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          }
          label="Failures Detected"
          value={run.totalFailures}
          color="red"
        />
        <StatCard
          icon={
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
          label="Fixes Applied"
          value={run.totalFixes}
          color="green"
        />
        <StatCard
          icon={
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          }
          label="Iterations"
          value={run.iterations}
          color="blue"
        />
        <StatCard
          icon={
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
          label="Duration"
          value={formatDuration(run.timeTaken)}
          color="purple"
        />
      </div>

      {/* Progress Ring + Meta Info */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Success Ring */}
        <div className="glass-card flex flex-col items-center justify-center py-8">
          <div className="relative h-32 w-32">
            <svg className="h-full w-full -rotate-90 transform">
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="currentColor"
                strokeWidth="12"
                fill="none"
                className="text-white/8"
              />
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="currentColor"
                strokeWidth="12"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${outcomeScore * 3.52} 352`}
                className={
                  run.status === "PASSED" ? "text-emerald-500" : "text-red-500"
                }
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span
                className={`text-3xl font-bold ${run.status === "PASSED" ? "text-emerald-400" : "text-red-400"}`}
              >
                {outcomeScore}%
              </span>
              <span className="text-xs uppercase tracking-[0.18em] text-ink-500">
                Outcome
              </span>
            </div>
          </div>
          <p className="mt-4 text-sm font-medium text-white">
            {run.status === "PASSED"
              ? "All issues resolved"
              : "Some issues remain"}
          </p>
          <p className="mt-1 text-xs text-ink-500">
            Remediation coverage: {remediationCoverage}%
          </p>
        </div>

        {/* Meta Info */}
        <div className="glass-card lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-ink-500">
            Run Details
          </h3>
          <div className="space-y-3">
            <InfoRow icon="🌿" label="Branch" value={run.branch} mono />
            <InfoRow
              icon="🧭"
              label="Repository Source"
              value={run.repositorySource === "remote" ? "Remote GitHub repository" : "Local workspace"}
            />
            <InfoRow
              icon="📤"
              label="Writeback Mode"
              value={run.writebackEnabled ? "GitHub writeback enabled" : "Review-first (no automatic push)"}
            />
            <InfoRow icon="👤" label="Team" value={run.teamName} />
            <InfoRow icon="👑" label="Leader" value={run.leaderName} />
            <InfoRow
              icon="📅"
              label="Created"
              value={formatDate(run.createdAt)}
            />
            <InfoRow icon="🆔" label="Run ID" value={run.id} mono />
          </div>
        </div>
      </div>

      {failureDetails ? (
        <div className="rounded-[24px] border border-red-500/20 bg-red-500/10 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-red-300">
              Failure Diagnostics
            </h3>
            <span className="rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-red-200">
              {failureDetails.category}
            </span>
          </div>
          <p className="mt-3 text-sm text-red-100">{failureDetails.message}</p>
          {failureDetails.failingCommand ? (
            <div className="mt-4 rounded-2xl border border-white/8 bg-black/20 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-500">
                Failing Command
              </p>
              <p className="mt-2 break-all font-mono text-xs text-ink-200">
                {failureDetails.failingCommand}
              </p>
            </div>
          ) : null}
          {failureDetails.rawOutputExcerpt ? (
            <div className="mt-4 rounded-2xl border border-white/8 bg-black/20 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-500">
                Raw Error Excerpt
              </p>
              <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-ink-200">
                {failureDetails.rawOutputExcerpt}
              </pre>
            </div>
          ) : null}
        </div>
      ) : setupIssue ? (
        <div className="rounded-[24px] border border-red-500/20 bg-red-500/10 p-5">
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-red-300">
            Setup Issue Detected
          </h3>
          <p className="mt-2 text-sm text-red-200">{setupIssue.detail}</p>
        </div>
      ) : null}

      {(downloadUrl || changedFiles.length > 0) && (
        <div className="glass-card">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="eyebrow">Review Workspace</p>
              <h3 className="mt-2 text-lg font-semibold text-white">Patched Output</h3>
            </div>
            {downloadUrl ? (
              <a
                href={downloadUrl}
                className="inline-flex items-center gap-2 rounded-2xl border border-brand-500/20 bg-brand-500/10 px-4 py-2.5 text-sm font-semibold text-brand-300 transition-colors hover:bg-brand-500/15 hover:text-white"
              >
                Download Patched Zip
              </a>
            ) : null}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-[22px] border border-white/8 bg-black/10 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-500">
                Review Mode
              </p>
              <p className="mt-2 text-sm text-ink-300">
                {run.writebackEnabled
                  ? "This run was allowed to attempt GitHub write-back after generating fixes."
                  : "This run stayed in review-first mode. AtlasOps preserved the patched workspace for inspection instead of pushing changes automatically."}
              </p>
            </div>
            <div className="rounded-[22px] border border-white/8 bg-black/10 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-500">
                Changed Files
              </p>
              {changedFiles.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {changedFiles.map((file) => (
                    <span
                      key={file}
                      className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1 font-mono text-[11px] text-ink-200"
                    >
                      {file}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-ink-400">No file changes were applied in this run.</p>
              )}
            </div>
          </div>

          {run.artifact ? (
            <div className="mt-4 rounded-[22px] border border-white/8 bg-black/10 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-500">
                Artifact Bundle
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-ink-500">
                    Workspace Directory
                  </p>
                  <p className="mt-1 break-all font-mono text-[11px] text-ink-200">
                    {run.artifact.workspaceDirectory}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-ink-500">
                    Run Artifact Directory
                  </p>
                  <p className="mt-1 break-all font-mono text-[11px] text-ink-200">
                    {run.artifact.runDirectory}
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Timeline */}
      <div className="glass-card">
        <div className="mb-6 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-ink-500">
              Pipeline Timeline
            </h3>
            <span className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1 text-xs font-medium text-ink-300">
              {run.timeline?.length ?? 0} events
            </span>
        </div>

        {run.timeline && run.timeline.length > 0 ? (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute bottom-0 left-4 top-0 w-0.5 bg-gradient-to-b from-brand-500 via-brand-600 to-transparent" />

            <div className="space-y-4">
              {run.timeline.map((entry, idx) => (
                <TimelineItem
                  key={idx}
                  entry={entry}
                  isLast={idx === run.timeline.length - 1}
                />
              ))}
            </div>
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-ink-400">
            No timeline events recorded
          </p>
        )}
      </div>

      {/* Fixes Applied */}
      {run.fixes && run.fixes.length > 0 && (
        <div className="glass-card">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-ink-500">
              Fixes Applied
            </h3>
            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
              {run.fixes.filter((f) => f.fixApplied).length} /{" "}
              {run.fixes.length} successful
            </span>
          </div>

          <div className="space-y-3">
            {run.fixes.map((fix, idx) => (
              <FixCard key={idx} fix={fix} />
            ))}
          </div>
        </div>
      )}

      {/* Formatted Failures (Judge Output) */}
      {run.formattedFailures && run.formattedFailures.length > 0 && (
        <div className="glass-card">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-ink-500">
            Judge Output Format
          </h3>
          <div className="rounded-[22px] border border-white/8 bg-surface p-4 font-mono text-xs">
            {run.formattedFailures.map((line, idx) => (
              <div
                key={idx}
                className="border-b border-white/8 py-1 text-ink-200 last:border-0"
              >
                {line}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Components ────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: "red" | "green" | "blue" | "purple";
}) {
  const colors = {
    red: "bg-red-500/10 text-red-400 border-red-500/20",
    green: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    blue: "bg-brand-500/10 text-brand-400 border-brand-500/20",
    purple: "bg-accent-500/10 text-accent-300 border-accent-500/20",
  };

  return (
    <div className="rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.015))] p-4">
      <div
        className={`mb-3 inline-flex rounded-xl border p-2.5 ${colors[color]}`}
      >
        {icon}
      </div>
      <p className="text-[11px] uppercase tracking-[0.18em] text-ink-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
  mono = false,
}: {
  icon: string;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-[20px] border border-white/8 bg-white/[0.03] px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="text-base">{icon}</span>
        <span className="text-sm text-ink-400">{label}</span>
      </div>
      <span className={`text-sm text-white ${mono ? "font-mono text-xs text-ink-200" : ""}`}>
        {value}
      </span>
    </div>
  );
}

function TimelineItem({
  entry,
  isLast,
}: {
  entry: { timestamp: string; event: string; detail?: string };
  isLast: boolean;
}) {
  const getEventStyle = (event: string) => {
    if (
      event.includes("PASSED") ||
      event.includes("SUCCESS") ||
      event.includes("DONE")
    )
      return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    if (event.includes("FAILED") || event.includes("ERROR"))
      return "bg-red-500/20 text-red-400 border-red-500/30";
    if (event.includes("PUSH") || event.includes("COMMIT"))
      return "bg-accent-500/15 text-accent-300 border-accent-500/25";
    if (event.includes("FIX") || event.includes("PATCH"))
      return "bg-brand-500/15 text-brand-300 border-brand-500/25";
    return "bg-white/[0.04] text-ink-300 border-white/8";
  };

  return (
    <div className="relative flex gap-4 pl-10">
      {/* Dot */}
      <div
        className={`absolute left-2.5 top-2 h-3 w-3 rounded-full border-2 ${isLast ? "bg-brand-500 border-brand-400" : "bg-surface border-surface-border"}`}
      />

      <div className="flex-1 rounded-[22px] border border-white/8 bg-white/[0.03] p-4">
        <div className="flex items-start justify-between gap-3">
          <span
            className={`inline-block rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${getEventStyle(entry.event)}`}
          >
            {entry.event}
          </span>
          <span className="whitespace-nowrap text-xs text-ink-500">
            {new Date(entry.timestamp).toLocaleTimeString()}
          </span>
        </div>
        {entry.detail && (
          <p className="mt-2 break-all font-mono text-xs text-ink-300">
            {entry.detail}
          </p>
        )}
      </div>
    </div>
  );
}

function FixCard({
  fix,
}: {
  fix: {
    file: string;
    line: number;
    bugType: string;
    error: string;
    fixApplied: boolean;
  };
}) {
  return (
    <div
      className={`rounded-[22px] border p-4 ${fix.fixApplied ? "border-emerald-500/20 bg-emerald-500/8" : "border-red-500/20 bg-red-500/8"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${fix.fixApplied ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"}`}
            >
              {fix.fixApplied ? "✓" : "✗"}
            </span>
            <span className="font-mono text-sm text-white truncate">
              {fix.file}
            </span>
            <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-xs text-ink-300">
              L{fix.line}
            </span>
          </div>
          <p className="mt-2 text-xs text-ink-400">{fix.error}</p>
        </div>
        <span
          className={`flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
            fix.bugType === "syntax_error"
              ? "border border-red-500/20 bg-red-500/10 text-red-300"
              : fix.bugType === "import_error"
                ? "border border-accent-500/20 bg-accent-500/10 text-accent-300"
                : fix.bugType === "type_error"
                  ? "border border-brand-500/20 bg-brand-500/10 text-brand-300"
                  : "border border-white/8 bg-white/[0.04] text-ink-300"
          }`}
        >
          {fix.bugType.replace(/_/g, " ")}
        </span>
      </div>
    </div>
  );
}
