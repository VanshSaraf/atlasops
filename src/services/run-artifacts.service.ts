import fs from "fs";
import path from "path";
import { config, createLogger } from "../utils";

const logger = createLogger("RunArtifactsService");

const RUN_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/;

export interface RunArtifactSummary {
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

export interface RunArtifactDetail {
  result: Record<string, unknown>;
  artifact: {
    zipExists: boolean;
    downloadPath?: string;
  };
}

interface RunDirectoryEntry {
  runId: string;
  runDir: string;
  modifiedTimeMs: number;
}

export class RunArtifactsService {
  private runsRoot: string;

  constructor(artifactsDir = config.artifactsDir) {
    this.runsRoot = path.resolve(process.cwd(), artifactsDir, "runs");
  }

  isValidRunId(runId: string): boolean {
    return RUN_ID_PATTERN.test(runId);
  }

  listRuns(): RunArtifactSummary[] {
    const entries = this.listRunDirectories();
    const summaries: Array<RunArtifactSummary & { sortTimeMs: number }> = [];

    for (const entry of entries) {
      const result = this.readResultFile(entry.runDir);
      if (!result) {
        continue;
      }

      summaries.push({
        ...this.toSummary(entry.runId, result, entry.modifiedTimeMs),
        sortTimeMs: this.getSortTimeMs(result, entry.modifiedTimeMs),
      });
    }

    return summaries
      .sort((a, b) => b.sortTimeMs - a.sortTimeMs)
      .map(({ sortTimeMs: _sortTimeMs, ...summary }) => summary);
  }

  getRun(runId: string): RunArtifactDetail | null {
    const runDir = this.resolveRunDirectory(runId);
    if (!runDir || !fs.existsSync(runDir)) {
      return null;
    }

    const result = this.readResultFile(runDir);
    if (!result) {
      return null;
    }

    const zipExists = this.zipExists(runId, runDir);
    const downloadPath = zipExists ? this.getDownloadPath(runId) : undefined;
    const artifact = this.normalizeArtifact(result, runId, zipExists);

    return {
      result: {
        ...result,
        artifact,
      },
      artifact: {
        zipExists,
        downloadPath,
      },
    };
  }

  getZipPath(runId: string): string | null {
    const runDir = this.resolveRunDirectory(runId);
    if (!runDir) {
      return null;
    }

    const zipPath = path.join(runDir, `${runId}.zip`);
    return fs.existsSync(zipPath) && fs.statSync(zipPath).isFile()
      ? zipPath
      : null;
  }

  private listRunDirectories(): RunDirectoryEntry[] {
    if (!fs.existsSync(this.runsRoot)) {
      return [];
    }

    try {
      return fs
        .readdirSync(this.runsRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && this.isValidRunId(entry.name))
        .map((entry) => {
          const runDir = path.join(this.runsRoot, entry.name);
          const stats = fs.statSync(runDir);
          return {
            runId: entry.name,
            runDir,
            modifiedTimeMs: stats.mtimeMs,
          };
        });
    } catch (err) {
      logger.warn(
        `Could not list run artifacts: ${err instanceof Error ? err.message : err}`,
      );
      return [];
    }
  }

  private resolveRunDirectory(runId: string): string | null {
    if (!this.isValidRunId(runId)) {
      return null;
    }

    const resolved = path.resolve(this.runsRoot, runId);
    const rootWithSeparator = `${this.runsRoot}${path.sep}`;
    if (resolved !== this.runsRoot && resolved.startsWith(rootWithSeparator)) {
      return resolved;
    }

    return null;
  }

  private readResultFile(runDir: string): Record<string, unknown> | null {
    const resultPath = path.join(runDir, "result.json");
    if (!fs.existsSync(resultPath)) {
      return null;
    }

    try {
      return JSON.parse(fs.readFileSync(resultPath, "utf-8")) as Record<
        string,
        unknown
      >;
    } catch (err) {
      logger.warn(
        `Could not read result artifact: ${err instanceof Error ? err.message : err}`,
      );
      return null;
    }
  }

  private toSummary(
    runId: string,
    result: Record<string, unknown>,
    modifiedTimeMs: number,
  ): RunArtifactSummary {
    const artifactAvailable = this.zipExists(runId);
    const createdAt = this.getString(result.createdAt);
    const completedAt = this.getTimelineTimestamp(result, "ORCHESTRATOR_DONE");
    const failureDetails = this.getObject(result.failureDetails);

    return {
      runId: this.getString(result.id) ?? runId,
      status: this.getString(result.status),
      repoUrl: this.getString(result.repository),
      repositorySource: this.getString(result.repositorySource),
      startedAt: createdAt,
      completedAt,
      timestamp: completedAt ?? createdAt ?? new Date(modifiedTimeMs).toISOString(),
      duration: this.getNumber(result.timeTaken),
      attempts: this.getNumber(result.iterations),
      retryCount: this.getNumber(result.iterations),
      totalFixes: this.getNumber(result.totalFixes),
      appliedFixes: this.getAppliedFixCount(result),
      artifactAvailable,
      downloadPath: artifactAvailable ? this.getDownloadPath(runId) : undefined,
      failureSummary: failureDetails
        ? {
            category: this.getString(failureDetails.category),
            message: this.getString(failureDetails.message),
          }
        : undefined,
    };
  }

  private getSortTimeMs(
    result: Record<string, unknown>,
    fallbackTimeMs: number,
  ): number {
    const timestamp =
      this.getTimelineTimestamp(result, "ORCHESTRATOR_DONE") ??
      this.getString(result.createdAt);
    const parsed = timestamp ? Date.parse(timestamp) : Number.NaN;
    return Number.isFinite(parsed) ? parsed : fallbackTimeMs;
  }

  private getTimelineTimestamp(
    result: Record<string, unknown>,
    event: string,
  ): string | undefined {
    const timeline = Array.isArray(result.timeline) ? result.timeline : [];
    const match = [...timeline]
      .reverse()
      .find((entry) => this.getObject(entry)?.event === event);
    return match ? this.getString(this.getObject(match)?.timestamp) : undefined;
  }

  private normalizeArtifact(
    result: Record<string, unknown>,
    runId: string,
    zipExists: boolean,
  ): Record<string, unknown> {
    const artifact = this.getObject(result.artifact) ?? {};
    return {
      ...artifact,
      zipExists,
      downloadPath: zipExists ? this.getDownloadPath(runId) : undefined,
    };
  }

  private zipExists(runId: string, runDir?: string): boolean {
    const resolvedRunDir = runDir ?? this.resolveRunDirectory(runId);
    if (!resolvedRunDir) {
      return false;
    }

    const zipPath = path.join(resolvedRunDir, `${runId}.zip`);
    return fs.existsSync(zipPath) && fs.statSync(zipPath).isFile();
  }

  private getDownloadPath(runId: string): string {
    return `/api/runs/${runId}/download`;
  }

  private getAppliedFixCount(result: Record<string, unknown>): number | undefined {
    const fixes = Array.isArray(result.fixes) ? result.fixes : undefined;
    if (!fixes) {
      return this.getNumber(result.totalFixes);
    }

    return fixes.filter((fix) => this.getObject(fix)?.fixApplied === true).length;
  }

  private getObject(value: unknown): Record<string, unknown> | undefined {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
  }

  private getString(value: unknown): string | undefined {
    return typeof value === "string" ? value : undefined;
  }

  private getNumber(value: unknown): number | undefined {
    return typeof value === "number" && Number.isFinite(value)
      ? value
      : undefined;
  }
}
