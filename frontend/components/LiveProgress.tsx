"use client";

import { useState, useEffect, useRef } from "react";
import { TimelineEntry, AgentRun, RunAgentRequest } from "@/types";
import { triggerAgentStream } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  GitBranch,
  TestTube2,
  Search,
  Wrench,
  Upload,
  Activity,
  CheckCircle2,
  XCircle,
  Loader2,
  Zap,
  AlertTriangle,
  Rocket,
  FileCode,
  GitPullRequest,
} from "lucide-react";

interface LiveProgressProps {
  payload: RunAgentRequest;
  onComplete: (result: AgentRun) => void;
  onError: (error: string) => void;
  onCancel: () => void;
}

interface StepInfo {
  icon: React.ReactNode;
  label: string;
  color: string;
  bgColor: string;
}

const EVENT_CONFIG: Record<string, StepInfo> = {
  ORCHESTRATOR_START: {
    icon: <Rocket className="w-4 h-4" />,
    label: "Starting Recovery",
    color: "text-brand-300",
    bgColor: "bg-brand-500/15",
  },
  CLONE_START: {
    icon: <GitBranch className="w-4 h-4" />,
    label: "Cloning Repository",
    color: "text-sky-300",
    bgColor: "bg-sky-500/15",
  },
  CLONE_DONE: {
    icon: <GitBranch className="w-4 h-4" />,
    label: "Repository Cloned",
    color: "text-sky-300",
    bgColor: "bg-sky-500/15",
  },
  CLONE_FAILED: {
    icon: <XCircle className="w-4 h-4" />,
    label: "Clone Failed",
    color: "text-red-400",
    bgColor: "bg-red-500/20",
  },
  BRANCH_CREATED: {
    icon: <GitBranch className="w-4 h-4" />,
    label: "Branch Created",
    color: "text-sky-300",
    bgColor: "bg-sky-500/15",
  },
  ITERATION_START: {
    icon: <Zap className="w-4 h-4" />,
    label: "Iteration",
    color: "text-accent-300",
    bgColor: "bg-accent-500/15",
  },
  TEST_RUN_START: {
    icon: <TestTube2 className="w-4 h-4" />,
    label: "Running Tests",
    color: "text-accent-300",
    bgColor: "bg-accent-500/15",
  },
  TESTS_PASSED: {
    icon: <CheckCircle2 className="w-4 h-4" />,
    label: "Tests Passed",
    color: "text-emerald-300",
    bgColor: "bg-emerald-500/15",
  },
  TESTS_FAILED: {
    icon: <XCircle className="w-4 h-4" />,
    label: "Tests Failed",
    color: "text-red-400",
    bgColor: "bg-red-500/20",
  },
  SETUP_ERROR: {
    icon: <AlertTriangle className="w-4 h-4" />,
    label: "Setup Issue",
    color: "text-red-300",
    bgColor: "bg-red-500/15",
  },
  CLASSIFY_START: {
    icon: <Search className="w-4 h-4" />,
    label: "Classifying Failures",
    color: "text-brand-300",
    bgColor: "bg-brand-500/15",
  },
  CLASSIFY_DONE: {
    icon: <Search className="w-4 h-4" />,
    label: "Failures Classified",
    color: "text-brand-300",
    bgColor: "bg-brand-500/15",
  },
  CLASSIFY_REGEX_MISS: {
    icon: <AlertTriangle className="w-4 h-4" />,
    label: "Using LLM Fallback",
    color: "text-accent-300",
    bgColor: "bg-accent-500/15",
  },
  CLASSIFY_NO_FAILURES: {
    icon: <AlertTriangle className="w-4 h-4" />,
    label: "No Failures Found",
    color: "text-accent-300",
    bgColor: "bg-accent-500/15",
  },
  CLASSIFIED_FAILURE: {
    icon: <FileCode className="w-4 h-4" />,
    label: "Failure Detected",
    color: "text-red-300",
    bgColor: "bg-red-500/15",
  },
  FIX_GENERATE_START: {
    icon: <Wrench className="w-4 h-4" />,
    label: "Generating Remediation",
    color: "text-brand-300",
    bgColor: "bg-brand-500/15",
  },
  FIX_GENERATE_DONE: {
    icon: <Wrench className="w-4 h-4" />,
    label: "Remediation Drafted",
    color: "text-brand-300",
    bgColor: "bg-brand-500/15",
  },
  NO_FIXES_GENERATED: {
    icon: <AlertTriangle className="w-4 h-4" />,
    label: "No Fixes Generated",
    color: "text-accent-300",
    bgColor: "bg-accent-500/15",
  },
  PATCH_APPLY_START: {
    icon: <FileCode className="w-4 h-4" />,
    label: "Applying Patch",
    color: "text-brand-300",
    bgColor: "bg-brand-500/15",
  },
  PATCH_APPLY_DONE: {
    icon: <FileCode className="w-4 h-4" />,
    label: "Patch Applied",
    color: "text-brand-300",
    bgColor: "bg-brand-500/15",
  },
  COMMIT: {
    icon: <GitBranch className="w-4 h-4" />,
    label: "Changes Committed",
    color: "text-ink-200",
    bgColor: "bg-white/10",
  },
  WRITEBACK_REQUESTED: {
    icon: <GitPullRequest className="w-4 h-4" />,
    label: "Writeback Requested",
    color: "text-accent-300",
    bgColor: "bg-accent-500/15",
  },
  WRITEBACK_FAILED_SAFE: {
    icon: <AlertTriangle className="w-4 h-4" />,
    label: "Writeback Failed Safely",
    color: "text-accent-300",
    bgColor: "bg-accent-500/15",
  },
  PUSH_ATTEMPT: {
    icon: <Upload className="w-4 h-4" />,
    label: "Attempting Push",
    color: "text-accent-300",
    bgColor: "bg-accent-500/15",
  },
  PUSH: {
    icon: <Upload className="w-4 h-4" />,
    label: "Fix Branch Pushed",
    color: "text-emerald-300",
    bgColor: "bg-emerald-500/15",
  },
  PUSH_SKIPPED: {
    icon: <Upload className="w-4 h-4" />,
    label: "Remote Push Skipped",
    color: "text-ink-300",
    bgColor: "bg-white/10",
  },
  PUSH_FAILED: {
    icon: <XCircle className="w-4 h-4" />,
    label: "Push Failed",
    color: "text-red-400",
    bgColor: "bg-red-500/20",
  },
  PUSH_FALLBACK: {
    icon: <GitPullRequest className="w-4 h-4" />,
    label: "Trying Fix Branch + PR",
    color: "text-accent-300",
    bgColor: "bg-accent-500/15",
  },
  CI_MONITOR_START: {
    icon: <Activity className="w-4 h-4" />,
    label: "Monitoring CI",
    color: "text-sky-300",
    bgColor: "bg-sky-500/15",
  },
  CI_PASSED: {
    icon: <CheckCircle2 className="w-4 h-4" />,
    label: "CI Passed",
    color: "text-emerald-300",
    bgColor: "bg-emerald-500/15",
  },
  CI_FAILED: {
    icon: <XCircle className="w-4 h-4" />,
    label: "CI Failed",
    color: "text-red-400",
    bgColor: "bg-red-500/20",
  },
  PR_CREATE_START: {
    icon: <GitPullRequest className="w-4 h-4" />,
    label: "Creating Pull Request",
    color: "text-sky-300",
    bgColor: "bg-sky-500/15",
  },
  PR_CREATED: {
    icon: <GitPullRequest className="w-4 h-4" />,
    label: "Pull Request Created",
    color: "text-emerald-300",
    bgColor: "bg-emerald-500/15",
  },
  PR_CREATE_SKIPPED: {
    icon: <GitPullRequest className="w-4 h-4" />,
    label: "PR Creation Unavailable",
    color: "text-accent-300",
    bgColor: "bg-accent-500/15",
  },
  PR_CREATE_FAILED: {
    icon: <GitPullRequest className="w-4 h-4" />,
    label: "PR Creation Failed",
    color: "text-red-400",
    bgColor: "bg-red-500/20",
  },
  ORCHESTRATOR_DONE: {
    icon: <CheckCircle2 className="w-4 h-4" />,
    label: "Recovery Complete",
    color: "text-emerald-300",
    bgColor: "bg-emerald-500/15",
  },
};

const DEFAULT_STEP: StepInfo = {
  icon: <Activity className="w-4 h-4" />,
  label: "Processing",
  color: "text-ink-300",
  bgColor: "bg-white/10",
};

export default function LiveProgress({
  payload,
  onComplete,
  onError,
  onCancel,
}: LiveProgressProps) {
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [isRunning, setIsRunning] = useState(true);
  const [currentStep, setCurrentStep] = useState<string>("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    const runAgent = async () => {
      try {
        await triggerAgentStream(payload, {
          onProgress: (entry) => {
            if (cancelled) return;
            setTimeline((prev) => [...prev, entry]);
            setCurrentStep(entry.event);
          },
          onResult: (result) => {
            if (cancelled) return;
            onComplete(result);
          },
          onError: (error) => {
            if (cancelled) return;
            onError(error);
            setIsRunning(false);
          },
          onDone: () => {
            if (cancelled) return;
            setIsRunning(false);
          },
        });
      } catch (err) {
        if (cancelled) return;
        onError(err instanceof Error ? err.message : "Unknown error");
        setIsRunning(false);
      }
    };

    runAgent();

    return () => {
      cancelled = true;
    };
  }, [payload, onComplete, onError]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [timeline]);

  const getStepInfo = (event: string): StepInfo => {
    return EVENT_CONFIG[event] || DEFAULT_STEP;
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const currentInfo = getStepInfo(currentStep);

  return (
    <div className="space-y-6">
      {/* Current Step Indicator */}
      <div className="rounded-[30px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.015))] p-6 shadow-[0_22px_70px_rgba(0,0,0,0.24)] backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {isRunning ? (
              <div className="relative">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500 animate-pulse">
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                </div>
                <div className="absolute -inset-1 rounded-2xl bg-brand-500/20 blur animate-pulse" />
              </div>
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15">
                <CheckCircle2 className="w-6 h-6 text-emerald-300" />
              </div>
            )}
            <div>
              <h3 className="text-lg font-semibold text-white">
                {isRunning ? "Recovery Running" : "Recovery Complete"}
              </h3>
              <p className={cn("text-sm", currentInfo.color)}>
                {currentInfo.label}
                {timeline.length > 0 &&
                  timeline[timeline.length - 1].detail &&
                  ` • ${timeline[timeline.length - 1].detail}`}
              </p>
            </div>
          </div>
          {isRunning && (
            <button
              onClick={onCancel}
              className="rounded-xl border border-red-500/25 bg-red-500/15 px-4 py-2 text-red-300 transition-colors hover:bg-red-500/25"
            >
              Cancel
            </button>
          )}
        </div>

        {/* Progress bar */}
        <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/8">
          <div
            className={cn(
              "h-full transition-all duration-500 ease-out",
              isRunning
                ? "bg-gradient-to-r from-brand-500 via-brand-400 to-accent-400 animate-pulse"
                : "bg-emerald-400",
            )}
            style={{
              width: isRunning
                ? `${Math.min(timeline.length * 8, 95)}%`
                : "100%",
            }}
          />
        </div>
      </div>

      {/* Timeline */}
      <div
        ref={scrollRef}
        className="max-h-[400px] overflow-y-auto rounded-[30px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.015))] backdrop-blur-sm"
      >
        <div className="border-b border-white/8 p-4">
          <h3 className="text-sm font-medium uppercase tracking-[0.18em] text-ink-400">
            Live Timeline
          </h3>
        </div>
        <div className="divide-y divide-white/6">
          {timeline.map((entry, index) => {
            const info = getStepInfo(entry.event);
            const isLatest = index === timeline.length - 1;
            return (
              <div
                key={index}
                className={cn(
                  "p-4 flex items-start gap-3 transition-all duration-300",
                  isLatest && isRunning && "bg-white/[0.03]",
                )}
                style={{
                  animation: isLatest ? "slideIn 0.3s ease-out" : undefined,
                }}
              >
                <div
                  className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                    info.bgColor,
                    info.color,
                  )}
                >
                  {info.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn("font-medium", info.color)}>
                      {info.label}
                    </span>
                    {isLatest && isRunning && (
                      <span className="flex items-center gap-1 text-xs text-brand-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-brand-300 animate-pulse" />
                        Active
                      </span>
                    )}
                  </div>
                  {entry.detail && (
                    <p className="mt-0.5 truncate text-sm text-ink-400">
                      {entry.detail}
                    </p>
                  )}
                </div>
                <span className="shrink-0 font-mono text-xs text-ink-500">
                  {formatTime(entry.timestamp)}
                </span>
              </div>
            );
          })}
          {timeline.length === 0 && (
            <div className="p-8 text-center text-ink-500">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
              <p>Waiting for events...</p>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(-10px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}
