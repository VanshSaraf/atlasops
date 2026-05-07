import fs from "fs";
import path from "path";
import { DockerService } from "./docker.service";
import { config } from "../utils";

export interface RuntimeDiagnostics {
  status: "ok";
  uptime: number;
  timestamp: string;
  version: string;
  runtime: {
    node: string;
    platform: string;
    pid: number;
    cwd: string;
  };
  checks: {
    dockerAvailable: boolean;
    githubConfigured: boolean;
    modelProviderConfigured: boolean;
    webhookConfigured: boolean;
  };
  artifacts: {
    latestResultsPath: string;
    runsDirectory: string;
    latestResultsExists: boolean;
  };
}

export class RuntimeDiagnosticsService {
  private docker: DockerService;

  constructor() {
    this.docker = new DockerService();
  }

  async getHealth(): Promise<RuntimeDiagnostics> {
    const artifactsRoot = path.resolve(process.cwd(), config.artifactsDir);
    const latestResultsPath = path.join(artifactsRoot, "results.json");
    const runsDirectory = path.join(artifactsRoot, "runs");

    return {
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      runtime: {
        node: process.version,
        platform: `${process.platform}/${process.arch}`,
        pid: process.pid,
        cwd: process.cwd(),
      },
      checks: {
        dockerAvailable: await this.docker.isDockerAvailable(),
        githubConfigured: Boolean(config.github.token),
        modelProviderConfigured: Boolean(
          config.nvidia.apiUrl && config.nvidia.apiKey,
        ),
        webhookConfigured: Boolean(config.webhookUrl),
      },
      artifacts: {
        latestResultsPath,
        runsDirectory,
        latestResultsExists: fs.existsSync(latestResultsPath),
      },
    };
  }
}
