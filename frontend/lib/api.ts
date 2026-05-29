import { apiUrl, getRunDownloadUrl } from "./constants";
import type {
  AgentRun,
  AnalyzeRequest,
  AnalyzeResponse,
  FixRecord,
  HealthResponse,
  RunAgentRequest,
  RunStatus,
  RunSummary,
  TimelineEntry,
} from "@/types";

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data?: T;
  timestamp: string;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(path), {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      body.message || body.error || `Request failed (${res.status})`,
    );
  }

  return res.json() as Promise<T>;
}

export async function checkHealth(): Promise<HealthResponse> {
  return request<HealthResponse>("/health");
}

export async function triggerAgent(
  payload: RunAgentRequest,
): Promise<AgentRun> {
  const res = await request<ApiEnvelope<AgentRun>>("/api/run-agent", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.success || !res.data) {
    throw new Error(res.message || "Agent run failed");
  }
  return normalizeRun(res.data);
}

export async function analyzeRepo(
  payload: AnalyzeRequest,
): Promise<AnalyzeResponse> {
  return request<AnalyzeResponse>("/api/analyze", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listRuns(): Promise<AgentRun[]> {
  const res = await request<ApiEnvelope<{ runs: RunSummary[] }>>("/api/runs");
  if (!res.success || !res.data) {
    throw new Error(res.message || "Could not load run history");
  }
  return (res.data.runs ?? []).map(normalizeRunSummary);
}

export async function getRun(runId: string): Promise<AgentRun> {
  const res = await request<ApiEnvelope<Record<string, unknown>>>(
    `/api/runs/${encodeURIComponent(runId)}`,
  );
  if (!res.success || !res.data) {
    throw new Error(res.message || "Run not found");
  }
  return normalizeRun(res.data);
}

export function getAgentRunDownloadUrl(runId: string): string {
  return getRunDownloadUrl(runId);
}

function normalizeRunSummary(summary: RunSummary): AgentRun {
  const status = normalizeStatus(summary.status);
  return {
    id: summary.runId,
    repository: summary.repoUrl || "Unknown repository",
    repositorySource:
      summary.repositorySource === "remote" ? "remote" : "local",
    writebackEnabled: false,
    teamName: "Unknown",
    leaderName: "Unknown",
    branch: "unknown",
    totalFailures: 0,
    totalFixes: summary.appliedFixes ?? summary.totalFixes ?? 0,
    iterations: summary.attempts ?? summary.retryCount ?? 0,
    status,
    timeTaken: summary.duration ?? 0,
    fixes: [],
    formattedFailures: [],
    timeline: [],
    createdAt: summary.startedAt ?? summary.timestamp ?? new Date().toISOString(),
    failureDetails: summary.failureSummary?.message
      ? {
          category: summary.failureSummary.category || "UNKNOWN",
          message: summary.failureSummary.message,
        }
      : undefined,
    artifact: {
      downloadPath: summary.downloadPath,
      zipExists: summary.artifactAvailable,
    },
  };
}

function normalizeRun(raw: unknown): AgentRun {
  const input = isRecord(raw) ? raw : {};
  const id = asString(input.id) || asString(input.runId) || crypto.randomUUID();
  const fixes = asArray(input.fixes).map(normalizeFix);
  const timeline = asArray(input.timeline).map(normalizeTimelineEntry);
  const artifact = normalizeArtifact(input.artifact, id);

  return {
    id,
    repository: asString(input.repository) || asString(input.repoUrl) || "Unknown repository",
    repositorySource:
      asString(input.repositorySource) === "remote" ? "remote" : "local",
    writebackEnabled: asBoolean(input.writebackEnabled) ?? false,
    teamName: asString(input.teamName) || "Unknown",
    leaderName: asString(input.leaderName) || "Unknown",
    branch: asString(input.branch) || "unknown",
    totalFailures: asNumber(input.totalFailures) ?? fixes.length,
    totalFixes:
      asNumber(input.totalFixes) ??
      fixes.filter((fix) => fix.fixApplied).length,
    iterations: asNumber(input.iterations) ?? 0,
    status: normalizeStatus(asString(input.status)),
    timeTaken: asNumber(input.timeTaken) ?? 0,
    fixes,
    formattedFailures: asArray(input.formattedFailures)
      .map((line) => (typeof line === "string" ? line : ""))
      .filter(Boolean),
    timeline,
    createdAt:
      asString(input.createdAt) ||
      timeline[0]?.timestamp ||
      new Date().toISOString(),
    pullRequestUrl: asString(input.pullRequestUrl),
    failureDetails: normalizeFailureDetails(input.failureDetails),
    artifact,
  };
}

function normalizeFix(raw: unknown): FixRecord {
  const input = isRecord(raw) ? raw : {};
  return {
    file: asString(input.file) || "unknown",
    line: asNumber(input.line) ?? 0,
    bugType: asString(input.bugType) || "UNKNOWN",
    error: asString(input.error) || asString(input.originalError) || "No error message recorded",
    fixApplied: asBoolean(input.fixApplied) ?? false,
  };
}

function normalizeTimelineEntry(raw: unknown): TimelineEntry {
  const input = isRecord(raw) ? raw : {};
  return {
    timestamp: asString(input.timestamp) || new Date().toISOString(),
    event: asString(input.event) || "UNKNOWN",
    detail: asString(input.detail),
  };
}

function normalizeArtifact(raw: unknown, runId: string) {
  const input = isRecord(raw) ? raw : {};
  const zipExists = asBoolean(input.zipExists);
  const downloadPath = asString(input.downloadPath);
  return {
    runDirectory: asString(input.runDirectory),
    workspaceDirectory: asString(input.workspaceDirectory),
    zipPath: asString(input.zipPath),
    zipExists,
    downloadPath: downloadPath || (zipExists === true ? getRunDownloadUrl(runId) : undefined),
  };
}

function normalizeFailureDetails(raw: unknown) {
  const input = isRecord(raw) ? raw : undefined;
  if (!input) return undefined;
  const message = asString(input.message);
  if (!message) return undefined;
  return {
    category: asString(input.category) || "UNKNOWN",
    message,
    failingCommand: asString(input.failingCommand),
    rawOutputExcerpt: asString(input.rawOutputExcerpt),
  };
}

function normalizeStatus(status: string | undefined): RunStatus {
  if (status === "PASSED" || status === "FAILED" || status === "RUNNING") {
    return status;
  }
  return "PENDING";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

// ── SSE Streaming API ─────────────────────────────────────────

export interface StreamCallbacks {
  onProgress: (entry: TimelineEntry) => void;
  onResult: (result: AgentRun) => void;
  onError: (error: string) => void;
  onDone: () => void;
}

export async function triggerAgentStream(
  payload: RunAgentRequest,
  callbacks: StreamCallbacks,
): Promise<void> {
  const response = await fetch(apiUrl("/api/run-agent-stream"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.message || `Request failed (${response.status})`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("No response body");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Parse SSE events from buffer
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // Keep incomplete line in buffer

      let currentEventType = "";

      for (const line of lines) {
        if (line.startsWith("event: ")) {
          currentEventType = line.slice(7).trim();
        } else if (line.startsWith("data: ")) {
          const data = line.slice(6);
          try {
            const parsed = JSON.parse(data);

            switch (currentEventType) {
              case "progress":
                callbacks.onProgress(parsed as TimelineEntry);
                break;
              case "result":
                if (parsed.data) {
                  callbacks.onResult(normalizeRun(parsed.data));
                }
                break;
              case "error":
                callbacks.onError(parsed.message || "Unknown error");
                break;
              case "done":
                callbacks.onDone();
                break;
            }
          } catch {
            // Ignore parse errors
          }
          currentEventType = "";
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
