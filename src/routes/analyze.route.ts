import { Router, Request, Response } from "express";
import { RepoAnalyzerAgent } from "../agents/repo-analyzer.agent";
import { DockerService } from "../services/docker.service";
import { createLogger, validateRunRequest } from "../utils";

const logger = createLogger("AnalyzeRoute");
const router = Router();

interface AnalyzeRequest {
  repoUrl: string;
  runTests?: boolean;
}

interface AnalyzeResponse {
  success: boolean;
  message: string;
  data?: unknown;
  timestamp: string;
}

router.post("/analyze", async (req: Request, res: Response) => {
  const validation = validateRunRequest(req.body as Record<string, unknown>);
  if (!validation.ok || !validation.data) {
    const response: AnalyzeResponse = {
      success: false,
      message: validation.message || "Invalid request",
      timestamp: new Date().toISOString(),
    };
    res.status(400).json(response);
    return;
  }
  const body = req.body as AnalyzeRequest;
  const normalized = validation.data;

  const shouldRunTests = body.runTests ?? true;
  const analyzer = new RepoAnalyzerAgent();
  const docker = new DockerService();

  logger.info(`Analyze request: ${normalized.repoUrl} (runTests=${shouldRunTests})`);

  try {
    const analysis = await analyzer.analyze(normalized.repoUrl);

    let testResult = null;
    if (shouldRunTests && analysis.language !== "unknown") {
      const dockerAvailable = await docker.isDockerAvailable();
      if (!dockerAvailable) {
        logger.warn("Docker not available, skipping container test run");
      } else {
        testResult = await docker.runTests(
          analysis.localPath,
          analysis.language,
          analysis.installCommand,
          analysis.testCommand,
        );
      }
    }

    const response: AnalyzeResponse = {
      success: true,
      message: "Repository analyzed successfully",
      data: {
        analysis: {
          repoUrl: analysis.repoUrl,
          language: analysis.language,
          testCommand: analysis.testCommand,
          installCommand: analysis.installCommand,
          hasLockFile: analysis.hasLockFile,
          detectedFiles: analysis.detectedFiles,
        },
        testResult: testResult
          ? {
              passed: testResult.passed,
              executionTime: testResult.executionTime,
              output: testResult.output,
            }
          : null,
        dockerAvailable: testResult !== null,
      },
      timestamp: new Date().toISOString(),
    };

    res.json(response);

    // Clean up cloned repo in background
    try {
      analyzer.cleanup(analysis.localPath);
    } catch {
      logger.warn("Background cleanup failed");
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error(`Analyze failed: ${errorMsg}`);

    const response: AnalyzeResponse = {
      success: false,
      message: errorMsg,
      timestamp: new Date().toISOString(),
    };

    res.status(500).json(response);
  }
});

export default router;
