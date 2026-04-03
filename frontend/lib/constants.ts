export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export const ENDPOINTS = {
  health: `${API_URL}/health`,
  runAgent: `${API_URL}/api/run-agent`,
  runAgentStream: `${API_URL}/api/run-agent-stream`,
  analyze: `${API_URL}/api/analyze`,
} as const;

export function getRunDownloadUrl(runId: string): string {
  return `${API_URL}/api/runs/${runId}/download`;
}

export const APP_NAME = "AtlasOps";
export const APP_TAGLINE = "AI Delivery Reliability Platform";
export const APP_DESCRIPTION =
  "Recover failing pipelines, generate safe fixes, and keep delivery moving with AI-guided remediation.";
export const APP_REPOSITORY_URL = "https://github.com/YOUR_GITHUB_ORG/atlasops";

export const BUG_TYPE_LABELS: Record<string, string> = {
  LINTING: "Lint Error",
  SYNTAX: "Syntax Error",
  LOGIC: "Logic Error",
  TYPE_ERROR: "Type Error",
  IMPORT: "Import Error",
  INDENTATION: "Indentation Error",
};

export const BUG_TYPE_COLORS: Record<string, string> = {
  LINTING: "bg-accent-500/15 text-accent-300 border-accent-500/25",
  SYNTAX: "bg-red-500/15 text-red-300 border-red-500/25",
  LOGIC: "bg-brand-500/15 text-brand-300 border-brand-500/25",
  TYPE_ERROR: "bg-orange-500/15 text-orange-300 border-orange-500/25",
  IMPORT: "bg-sky-500/15 text-sky-300 border-sky-500/25",
  INDENTATION: "bg-teal-500/15 text-teal-300 border-teal-500/25",
};

export const STATUS_COLORS: Record<string, string> = {
  PASSED: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  FAILED: "bg-red-500/15 text-red-300 border-red-500/25",
  RUNNING: "bg-brand-500/15 text-brand-300 border-brand-500/25",
  PENDING: "bg-white/10 text-ink-300 border-white/10",
};
