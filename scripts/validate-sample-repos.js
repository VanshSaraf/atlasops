const fs = require("fs");
const path = require("path");

const { Orchestrator } = require("../dist/orchestrator");

function resolveSampleBase() {
  const cliArg = process.argv[2];
  if (cliArg) {
    return path.resolve(cliArg);
  }

  if (process.env.SAMPLE_REPOS_DIR) {
    return path.resolve(process.env.SAMPLE_REPOS_DIR);
  }

  return path.resolve(process.cwd(), "test-repos");
}

async function main() {
  const sampleBase = resolveSampleBase();

  if (!fs.existsSync(sampleBase)) {
    throw new Error(`Sample repo directory not found: ${sampleBase}`);
  }

  const repoNames = fs
    .readdirSync(sampleBase)
    .filter((name) => /^\d{2}-/.test(name))
    .sort();

  const summary = [];

  for (const name of repoNames) {
    const repoPath = path.join(sampleBase, name);
    if (!fs.statSync(repoPath).isDirectory()) {
      continue;
    }

    const orchestrator = new Orchestrator();
    const startedAt = Date.now();

    try {
      const result = await orchestrator.run({
        repoUrl: repoPath,
        teamName: "Validation",
        leaderName: "Codex",
        retryLimit: 2,
        dryRun: true,
      });

      summary.push({
        repo: name,
        status: result.status,
        failures: result.totalFailures,
        fixes: result.totalFixes,
        iterations: result.iterations,
        timeTaken: result.timeTaken,
        lastEvents: result.timeline.slice(-6),
      });
    } catch (error) {
      summary.push({
        repo: name,
        status: "ERROR",
        failures: 0,
        fixes: 0,
        iterations: 0,
        timeTaken: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
