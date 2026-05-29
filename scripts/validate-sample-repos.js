const fs = require("fs");
const path = require("path");

const SUPPORTED_SAMPLE_NAME = /^(repo\d+|\d{2})-/;

function resolveSampleBase() {
  const cliArg = process.argv[2];
  if (cliArg) return path.resolve(cliArg);
  if (process.env.SAMPLE_REPOS_DIR) return path.resolve(process.env.SAMPLE_REPOS_DIR);
  return path.resolve(process.cwd(), "test-repos");
}

function listFiles(dir) {
  const files = [];

  function walk(currentDir) {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const fullPath = path.join(currentDir, entry.name);
      const relPath = path.relative(dir, fullPath).split(path.sep).join("/");
      if (entry.isDirectory()) {
        walk(fullPath);
      } else {
        files.push(relPath);
      }
    }
  }

  walk(dir);
  return files.sort();
}

function detectLanguage(files) {
  if (files.includes("package.json")) return "node";
  if (
    files.includes("requirements.txt") ||
    files.includes("pyproject.toml") ||
    files.some((file) => file.endsWith(".py"))
  ) {
    return "python";
  }
  return "unknown";
}

function validateRepo(repoPath) {
  const files = listFiles(repoPath);
  const language = detectLanguage(files);
  const errors = [];

  if (language === "unknown") {
    errors.push("could not detect Python or Node sample repo");
  }

  if (language === "python") {
    if (!files.some((file) => file.endsWith(".py"))) {
      errors.push("Python sample must include at least one .py file");
    }
    if (!files.some((file) => file.startsWith("tests/") && file.endsWith(".py"))) {
      errors.push("Python sample should include a tests/*.py file");
    }
    if (
      !files.includes("requirements.txt") &&
      !files.includes("pyproject.toml") &&
      !files.includes("setup.py")
    ) {
      errors.push("Python sample should include requirements.txt, pyproject.toml, or setup.py");
    }
  }

  if (language === "node") {
    if (!files.includes("package.json")) {
      errors.push("Node sample must include package.json");
    }
    if (!files.some((file) => /\.(js|ts|jsx|tsx)$/.test(file))) {
      errors.push("Node sample must include at least one JS/TS source file");
    }
  }

  return {
    repo: path.basename(repoPath),
    language,
    files: files.length,
    ok: errors.length === 0,
    errors,
  };
}

function main() {
  const sampleBase = resolveSampleBase();

  if (!fs.existsSync(sampleBase)) {
    throw new Error(`Sample repo directory not found: ${sampleBase}`);
  }

  const repoNames = fs
    .readdirSync(sampleBase)
    .filter((name) => SUPPORTED_SAMPLE_NAME.test(name))
    .filter((name) => fs.statSync(path.join(sampleBase, name)).isDirectory())
    .sort();

  if (repoNames.length === 0) {
    throw new Error(
      `No sample repositories found in ${sampleBase}. Expected names like repo1-* or 01-*`,
    );
  }

  const results = repoNames.map((name) => validateRepo(path.join(sampleBase, name)));
  const failed = results.filter((result) => !result.ok);

  console.log(JSON.stringify({ sampleBase, count: results.length, results }, null, 2));

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
