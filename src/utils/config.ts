import dotenv from "dotenv";
dotenv.config();

export interface AppConfig {
  port: number;
  nodeEnv: string;
  frontendUrl: string;
  github: {
    token: string;
    owner: string;
    repo: string;
  };
  nvidia: {
    apiUrl: string;
    apiKey: string;
  };
  teamName: string;
  leaderName: string;
  retryLimit: number;
  agentTimeoutMs: number;
  webhookUrl: string;
  allowHostFallback: boolean;
  artifactsDir: string;
}

function optionalEnv(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

function optionalBoolEnv(key: string, fallback: boolean): boolean {
  const value = process.env[key];
  if (value === undefined) {
    return fallback;
  }
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function loadConfig(): AppConfig {
  return {
    port: parseInt(optionalEnv("PORT", "3001"), 10),
    nodeEnv: optionalEnv("NODE_ENV", "development"),
    frontendUrl: optionalEnv("FRONTEND_URL", "http://localhost:3000"),
    github: {
      token: optionalEnv("GITHUB_TOKEN", ""),
      owner: optionalEnv("GITHUB_OWNER", ""),
      repo: optionalEnv("GITHUB_REPO", ""),
    },
    nvidia: {
      apiUrl: optionalEnv(
        "NVIDIA_API_URL",
        "https://integrate.api.nvidia.com/v1/chat/completions",
      ),
      apiKey: optionalEnv("NVIDIA_API_KEY", ""),
    },
    teamName: optionalEnv("TEAM_NAME", "TEAM"),
    leaderName: optionalEnv("LEADER_NAME", "LEADER"),
    retryLimit: parseInt(optionalEnv("RETRY_LIMIT", "5"), 10),
    agentTimeoutMs: parseInt(optionalEnv("AGENT_TIMEOUT_MS", "30000"), 10),
    webhookUrl: optionalEnv("WEBHOOK_URL", ""),
    allowHostFallback: optionalBoolEnv("ALLOW_HOST_FALLBACK", false),
    artifactsDir: optionalEnv("ARTIFACTS_DIR", "artifacts"),
  };
}

export const config = loadConfig();
