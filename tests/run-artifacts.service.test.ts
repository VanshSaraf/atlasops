import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RunArtifactsService } from "../src/services/run-artifacts.service";

describe("RunArtifactsService", () => {
  let tempRoot: string;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "atlasops-artifacts-"));
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it("accepts safe run IDs and rejects traversal IDs", () => {
    const service = new RunArtifactsService(tempRoot);

    expect(service.isValidRunId("run_123-abc.def")).toBe(true);
    expect(service.isValidRunId("../../x")).toBe(false);
    expect(service.isValidRunId("..")).toBe(false);
  });

  it("returns null for missing runs", () => {
    const service = new RunArtifactsService(tempRoot);

    expect(service.getRun("missing-run")).toBeNull();
    expect(service.getZipPath("missing-run")).toBeNull();
  });

  it("lists an empty artifacts directory without crashing", () => {
    const service = new RunArtifactsService(tempRoot);

    expect(service.listRuns()).toEqual([]);
  });

  it("reads a valid result.json and reports zip download availability", () => {
    const runId = "run-001";
    const runDir = path.join(tempRoot, "runs", runId);
    fs.mkdirSync(runDir, { recursive: true });
    fs.writeFileSync(
      path.join(runDir, "result.json"),
      JSON.stringify({
        id: runId,
        repository: "https://github.com/example/repo",
        repositorySource: "remote",
        status: "PASSED",
        createdAt: "2026-05-01T00:00:00.000Z",
        timeTaken: 1234,
        iterations: 2,
        totalFixes: 1,
        fixes: [{ file: "src/index.ts", fixApplied: true }],
        timeline: [
          {
            event: "ORCHESTRATOR_DONE",
            timestamp: "2026-05-01T00:00:02.000Z",
          },
        ],
      }),
      "utf-8",
    );
    fs.writeFileSync(path.join(runDir, `${runId}.zip`), "zip-bytes");

    const service = new RunArtifactsService(tempRoot);
    const runs = service.listRuns();
    const detail = service.getRun(runId);

    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      runId,
      status: "PASSED",
      repoUrl: "https://github.com/example/repo",
      artifactAvailable: true,
      downloadPath: `/api/runs/${runId}/download`,
    });
    expect(detail?.result.id).toBe(runId);
    expect(detail?.artifact.zipExists).toBe(true);
    expect(service.getZipPath(runId)).toBe(path.join(runDir, `${runId}.zip`));
  });
});
