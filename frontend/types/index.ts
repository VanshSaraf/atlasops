export type RunStatus = "PASSED" | "FAILED" | "RUNNING" | "PENDING";

export type BugType = string;

export interface FixRecord {
  file: string;
  line: number;
  bugType: BugType;
  error: string;
  fixApplied: boolean;
}

export interface TimelineEntry {
  timestamp: string;
  event: string;
  detail?: string;
}

export interface RunArtifact {
  runDirectory?: string;
  workspaceDirectory?: string;
  zipPath?: string;
  downloadPath?: string;
  zipExists?: boolean;
}

export interface FailureDetails {
  category: string;
  message: string;
  failingCommand?: string;
  rawOutputExcerpt?: string;
}

export interface AgentRun {
  id: string;
  repository: string;
  repositorySource: "local" | "remote";
  writebackEnabled: boolean;
  teamName: string;
  leaderName: string;
  branch: string;
  totalFailures: number;
  totalFixes: number;
  iterations: number;
  status: RunStatus;
  timeTaken: number;
  fixes: FixRecord[];
  formattedFailures: string[];
  timeline: TimelineEntry[];
  createdAt: string;
  pullRequestUrl?: string;
  failureDetails?: FailureDetails;
  artifact?: RunArtifact;
}

export interface RunSummary {
  runId: string;
  status?: string;
  repoUrl?: string;
  repositorySource?: string;
  startedAt?: string;
  completedAt?: string;
  timestamp?: string;
  duration?: number;
  attempts?: number;
  retryCount?: number;
  totalFixes?: number;
  appliedFixes?: number;
  artifactAvailable: boolean;
  downloadPath?: string;
  failureSummary?: {
    category?: string;
    message?: string;
  };
}

export interface HealthResponse {
  status: string;
  uptime: number;
  timestamp: string;
  version: string;
}

export interface RunAgentRequest {
  repoUrl: string;
  teamName: string;
  leaderName: string;
  retryLimit: number;
  dryRun?: boolean;
}

export interface AnalyzeRequest {
  repoUrl: string;
  runTests?: boolean;
}

export interface AnalyzeResponse {
  language: string;
  testCommand: string;
  installCommand: string;
  testOutput?: string;
  testPassed?: boolean;
}

export interface DashboardStats {
  totalRuns: number;
  passedRuns: number;
  failedRuns: number;
  totalFixesApplied: number;
  averageTime: number;
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}
