import { Router, Request, Response } from "express";
import { Orchestrator, TimelineEntry } from "../orchestrator";
import { RunArtifactsService } from "../services";
import { createLogger, validateRunRequest } from "../utils";

const logger = createLogger("AgentRoute");
const router = Router();
const runArtifacts = new RunArtifactsService();

export interface RunAgentRequest {
  repoUrl: string;
  teamName?: string;
  leaderName?: string;
  retryLimit?: number;
  dryRun?: boolean;
}

export interface RunAgentResponse {
  success: boolean;
  message: string;
  data?: unknown;
  timestamp: string;
}

router.get("/runs", (_req: Request, res: Response) => {
  const runs = runArtifacts.listRuns();
  res.json({
    success: true,
    message: "Run history loaded",
    data: { runs },
    timestamp: new Date().toISOString(),
  });
});

router.get("/runs/:runId", (req: Request, res: Response) => {
  const rawRunId = req.params.runId;
  const runId = Array.isArray(rawRunId) ? rawRunId[0] : rawRunId;

  if (!runId || !runArtifacts.isValidRunId(runId)) {
    res.status(400).json({
      success: false,
      message: "Invalid runId",
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const run = runArtifacts.getRun(runId);
  if (!run) {
    res.status(404).json({
      success: false,
      message: "Run not found",
      timestamp: new Date().toISOString(),
    });
    return;
  }

  res.json({
    success: true,
    message: "Run loaded",
    data: run.result,
    timestamp: new Date().toISOString(),
  });
});

router.get("/runs/:runId/download", (req: Request, res: Response) => {
  const rawRunId = req.params.runId;
  const runId = Array.isArray(rawRunId) ? rawRunId[0] : rawRunId;

  if (!runId || !runArtifacts.isValidRunId(runId)) {
    res.status(400).json({
      success: false,
      message: "Invalid runId",
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const artifactPath = runArtifacts.getZipPath(runId);

  if (!artifactPath) {
    res.status(404).json({
      success: false,
      message: "Run artifact not found",
      timestamp: new Date().toISOString(),
    });
    return;
  }

  res.download(artifactPath, `atlasops-${runId}.zip`);
});

// ── Standard POST endpoint (non-streaming) ──────────────────────

router.post("/run-agent", async (req: Request, res: Response) => {
  const validation = validateRunRequest(req.body as Record<string, unknown>);
  if (!validation.ok || !validation.data) {
    const response: RunAgentResponse = {
      success: false,
      message: validation.message || "Invalid request",
      timestamp: new Date().toISOString(),
    };
    res.status(400).json(response);
    return;
  }
  const body = validation.data;

  const dryRun = body.dryRun ?? true;

  logger.info(`Agent run requested: repo=${body.repoUrl}, dryRun=${dryRun}`);

  const orchestrator = new Orchestrator();

  try {
    const result = await orchestrator.run({
      repoUrl: body.repoUrl,
      teamName: body.teamName,
      leaderName: body.leaderName,
      retryLimit: body.retryLimit,
      dryRun,
    });

    const response: RunAgentResponse = {
      success: true,
      message: `Agent run completed: ${result.status}`,
      data: result,
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error(`Agent run failed: ${errorMsg}`);

    const response: RunAgentResponse = {
      success: false,
      message: errorMsg,
      timestamp: new Date().toISOString(),
    };

    res.status(500).json(response);
  }
});

// ── SSE streaming endpoint ─────────────────────────────────────

router.post("/run-agent-stream", async (req: Request, res: Response) => {
  const validation = validateRunRequest(req.body as Record<string, unknown>);
  if (!validation.ok || !validation.data) {
    res.status(400).json({
      success: false,
      message: validation.message || "Invalid request",
      timestamp: new Date().toISOString(),
    });
    return;
  }
  const body = validation.data;

  const dryRun = body.dryRun ?? true;

  logger.info(
    `[SSE] Agent stream requested: repo=${body.repoUrl}, dryRun=${dryRun}`,
  );

  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering
  res.flushHeaders();

  const orchestrator = new Orchestrator();

  // Helper to send SSE event
  const sendEvent = (type: string, data: unknown) => {
    res.write(`event: ${type}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Progress callback - streams each timeline event
  const onProgress = (entry: TimelineEntry) => {
    sendEvent("progress", entry);
  };

  try {
    const result = await orchestrator.run({
      repoUrl: body.repoUrl,
      teamName: body.teamName,
      leaderName: body.leaderName,
      retryLimit: body.retryLimit,
      dryRun,
      onProgress,
    });

    // Send final result
    sendEvent("result", {
      success: true,
      message: `Agent run completed: ${result.status}`,
      data: result,
      timestamp: new Date().toISOString(),
    });

    sendEvent("done", { status: result.status });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error(`[SSE] Agent run failed: ${errorMsg}`);

    sendEvent("error", {
      success: false,
      message: errorMsg,
      timestamp: new Date().toISOString(),
    });
  } finally {
    res.end();
  }
});

export default router;
