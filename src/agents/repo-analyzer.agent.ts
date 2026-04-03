import path from "path";
import fs from "fs";
import os from "os";
import simpleGit from "simple-git";
import { createLogger, config } from "../utils";

const logger = createLogger("RepoAnalyzer");

export type DetectedLanguage = "node" | "python" | "unknown";

export interface RepoAnalysis {
  repoUrl: string;
  localPath: string;
  language: DetectedLanguage;
  testCommand: string;
  installCommand: string;
  hasLockFile: boolean;
  detectedFiles: string[];
}

const LANGUAGE_MARKERS: Record<DetectedLanguage, string[]> = {
  node: ["package.json", "yarn.lock", "pnpm-lock.yaml", "package-lock.json"],
  python: [
    "requirements.txt",
    "setup.py",
    "pyproject.toml",
    "Pipfile",
    "setup.cfg",
  ],
  unknown: [],
};

export class RepoAnalyzerAgent {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir ?? path.join(os.tmpdir(), "cicd-agent-repos");
    this.ensureBaseDir();
  }

  private ensureBaseDir(): void {
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
      logger.info(`Created repo base directory: ${this.baseDir}`);
    }
  }

  async analyze(repoUrl: string): Promise<RepoAnalysis> {
    logger.info(`Analyzing repository: ${repoUrl}`);

    const localPath = await this.cloneRepo(repoUrl);
    const files = this.listTopLevelFiles(localPath);
    const language = this.detectLanguage(files);
    const testCommand = this.detectTestCommand(localPath, language, files);
    const installCommand = this.detectInstallCommand(language, files, localPath);
    const hasLockFile = this.detectLockFile(files);

    const analysis: RepoAnalysis = {
      repoUrl,
      localPath,
      language,
      testCommand,
      installCommand,
      hasLockFile,
      detectedFiles: files,
    };

    logger.info(`Analysis complete`, {
      language,
      testCommand,
      installCommand,
      hasLockFile,
    });

    return analysis;
  }

  private async cloneRepo(
    repoUrl: string,
  ): Promise<string> {
    if (this.isLocalPath(repoUrl)) {
      return this.copyLocalRepo(repoUrl);
    }

    const repoName = this.extractRepoName(repoUrl);
    const timestamp = Date.now();
    const dirName = `${repoName}-${timestamp}`;
    const targetPath = path.join(this.baseDir, dirName);

    if (fs.existsSync(targetPath)) {
      logger.info(`Directory exists, removing: ${targetPath}`);
      fs.rmSync(targetPath, { recursive: true, force: true });
    }

    // Inject token for private repos or authenticated access
    let authUrl = repoUrl;
    const token = config.github.token;
    if (token) {
      try {
        // Build auth URL manually to avoid URL encoding issues with tokens
        const cleanUrl = repoUrl.replace(/\.git$/, "").trim();
        const match = cleanUrl.match(/github\.com[\/:]([^\/]+)\/([^\/]+)/);
        if (match) {
          const [, owner, repo] = match;
          authUrl = `https://x-access-token:${token}@github.com/${owner}/${repo}.git`;
          logger.info("Using x-access-token for clone authentication");
        } else {
          const url = new URL(repoUrl);
          if (url.hostname === "github.com") {
            url.username = "x-access-token";
            url.password = token;
            authUrl = url.toString();
            logger.info("Using x-access-token for clone authentication (URL fallback)");
          }
        }
      } catch {
        // Invalid URL, use as-is
      }
    }

    logger.info(`Cloning ${repoUrl} → ${targetPath}`);
    const git = simpleGit();
    await git.clone(authUrl, targetPath);
    logger.info(`Clone complete: ${targetPath}`);

    return targetPath;
  }

  private isLocalPath(repoUrl: string): boolean {
    if (fs.existsSync(repoUrl)) {
      return true;
    }

    return repoUrl.startsWith("/") || repoUrl.startsWith(".");
  }

  private copyLocalRepo(repoUrl: string): string {
    const sourcePath = path.resolve(repoUrl);

    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Local repository path not found: ${sourcePath}`);
    }

    const repoName = this.extractRepoName(sourcePath);
    const timestamp = Date.now();
    const targetPath = path.join(this.baseDir, `${repoName}-${timestamp}`);

    logger.info(`Copying local repository ${sourcePath} → ${targetPath}`);
    fs.cpSync(sourcePath, targetPath, {
      recursive: true,
      force: true,
      errorOnExist: false,
      filter: (src) => {
        const rel = path.relative(sourcePath, src);
        if (!rel || rel === "") {
          return true;
        }

        const segments = rel.split(path.sep);
        const blocked = new Set([
          ".git",
          "node_modules",
          ".next",
          "dist",
          "build",
          "coverage",
          ".pytest_cache",
          "__pycache__",
          ".venv",
          "venv",
          ".mypy_cache",
          ".ruff_cache",
        ]);

        return !segments.some((segment) => blocked.has(segment));
      },
    });

    return targetPath;
  }

  private extractRepoName(repoUrl: string): string {
    const sanitized = repoUrl.replace(/\.git$/, "").replace(/\/+$/, "");
    const parts = sanitized.split("/");
    const name = parts[parts.length - 1] || "repo";
    return name.replace(/[^a-zA-Z0-9_-]/g, "_");
  }

  private listTopLevelFiles(dir: string): string[] {
    try {
      return fs
        .readdirSync(dir)
        .filter((f) => f !== ".git" && f !== "." && f !== "..");
    } catch {
      logger.warn(`Could not list files in ${dir}`);
      return [];
    }
  }

  private detectLanguage(files: string[]): DetectedLanguage {
    const fileSet = new Set(files);

    for (const marker of LANGUAGE_MARKERS.node) {
      if (fileSet.has(marker)) {
        logger.info(`Detected language: node (marker: ${marker})`);
        return "node";
      }
    }

    for (const marker of LANGUAGE_MARKERS.python) {
      if (fileSet.has(marker)) {
        logger.info(`Detected language: python (marker: ${marker})`);
        return "python";
      }
    }

    // Fallback: check for file extensions
    const hasPyFiles = files.some((f) => f.endsWith(".py"));
    if (hasPyFiles) {
      logger.info("Detected language: python (found .py files)");
      return "python";
    }

    const hasJsTsFiles = files.some(
      (f) => f.endsWith(".js") || f.endsWith(".ts") || f.endsWith(".mjs"),
    );
    if (hasJsTsFiles) {
      logger.info("Detected language: node (found .js/.ts files)");
      return "node";
    }

    logger.warn("Could not detect language from top-level files");
    return "unknown";
  }

  private detectTestCommand(
    localPath: string,
    language: DetectedLanguage,
    files: string[],
  ): string {
    if (language === "node") {
      return this.detectNodeTestCommand(localPath);
    }

    if (language === "python") {
      return this.detectPythonTestCommand(localPath, files);
    }

    return "echo 'No test command detected'";
  }

  private detectNodeTestCommand(localPath: string): string {
    const pkgPath = path.join(localPath, "package.json");

    try {
      const raw = fs.readFileSync(pkgPath, "utf-8");
      const pkg = JSON.parse(raw);
      const scripts = pkg.scripts ?? {};

      if (
        scripts.test &&
        scripts.test !== 'echo "Error: no test specified" && exit 1'
      ) {
        logger.info(`Detected Node test script: "${scripts.test}"`);
        return "npm test";
      }

      if (scripts["test:ci"]) return "npm run test:ci";
      if (scripts["test:unit"]) return "npm run test:unit";

      logger.warn("No meaningful test script found in package.json");
      return "npm test";
    } catch {
      logger.warn("Could not read package.json for test command detection");
      return "npm test";
    }
  }

  private detectPythonTestCommand(localPath: string, files: string[]): string {
    const fileSet = new Set(files);
    const hasTestsDir = fileSet.has("tests") || fileSet.has("test");
    const runPytest = this.pythonPytestCommand(
      this.detectPythonPytestTarget(localPath, fileSet),
    );
    const runFlake8 = this.pythonFlake8Command(
      this.detectPythonLintTargets(localPath, fileSet),
    );

    if (fileSet.has(".flake8")) {
      logger.info("Detected flake8 configuration");
      return `${runFlake8} && ${runPytest}`;
    }

    if (
      fileSet.has("pytest.ini") ||
      fileSet.has("pyproject.toml") ||
      fileSet.has("setup.cfg")
    ) {
      logger.info("Detected pytest configuration");
      return this.pythonPytestCommand();
    }

    if (fileSet.has("tox.ini")) {
      logger.info("Detected tox configuration");
      return "tox";
    }

    if (hasTestsDir) {
      logger.info("Detected test directory, using pytest");
      return runPytest;
    }

    // Check for test files (test_*.py or *_test.py)
    const hasTestFiles = files.some(
      (f) =>
        f.endsWith(".py") && (f.startsWith("test_") || f.endsWith("_test.py")),
    );
    if (hasTestFiles) {
      logger.info("Found test files, using pytest");
      return this.pythonPytestCommand();
    }

    // No test framework: run all .py files directly to check for errors
    const pyFiles = files.filter(
      (f) => f.endsWith(".py") && !f.startsWith("__"),
    );
    if (pyFiles.length > 0) {
      const cmds = pyFiles
        .map((f) => `python3 ${f}`)
        .join(" && ");
      logger.info(`No test framework — running Python files directly: ${cmds}`);
      return cmds;
    }

    return this.pythonPytestCommand();
  }

  private detectInstallCommand(
    language: DetectedLanguage,
    files: string[],
    localPath: string,
  ): string {
    const fileSet = new Set(files);

    if (language === "node") {
      if (fileSet.has("package-lock.json")) return "npm ci --include=dev";
      if (fileSet.has("yarn.lock")) return "yarn install --frozen-lockfile";
      if (fileSet.has("pnpm-lock.yaml"))
        return "pnpm install --frozen-lockfile";
      return "npm install --include=dev";
    }

    if (language === "python") {
      const commands: string[] = [];
      const hasRequirements = fileSet.has("requirements.txt");
      const requirements = hasRequirements
        ? this.readRequirementsFile(localPath)
        : "";

      if (fileSet.has("Pipfile")) {
        commands.push("pipenv install");
      } else if (fileSet.has("pyproject.toml")) {
        commands.push(this.pythonEditableInstall());
      } else if (hasRequirements) {
        commands.push(this.pythonRequirementsInstall());
      }

      if (
        this.pythonRepoNeedsPytest(fileSet) &&
        !this.requirementsContainPackage(requirements, "pytest")
      ) {
        commands.push(this.pythonToolInstall("pytest"));
      }

      if (
        fileSet.has(".flake8") &&
        !this.requirementsContainPackage(requirements, "flake8")
      ) {
        commands.push(this.pythonToolInstall("flake8"));
      }

      return commands.length > 0
        ? commands.join(" && ")
        : "echo 'no dependencies to install'";
    }

    return "echo 'No install command detected'";
  }

  private detectLockFile(files: string[]): boolean {
    const lockFiles = [
      "package-lock.json",
      "yarn.lock",
      "pnpm-lock.yaml",
      "Pipfile.lock",
      "poetry.lock",
    ];
    return files.some((f) => lockFiles.includes(f));
  }

  private pythonRequirementsInstall(): string {
    return "python3 -m pip install -r requirements.txt";
  }

  private pythonEditableInstall(): string {
    return "python3 -m pip install -e .";
  }

  private pythonPytestCommand(target?: string): string {
    return target ? `python3 -m pytest ${target}` : "python3 -m pytest";
  }

  private pythonFlake8Command(targets?: string[]): string {
    const suffix = targets && targets.length > 0 ? ` ${targets.join(" ")}` : " .";
    return `python3 -m flake8${suffix}`;
  }

  private pythonToolInstall(tool: string): string {
    return `python3 -m pip install ${tool}`;
  }

  private readRequirementsFile(localPath: string): string {
    const requirementsPath = path.join(localPath, "requirements.txt");
    try {
      return fs.readFileSync(requirementsPath, "utf-8");
    } catch {
      return "";
    }
  }

  private requirementsContainPackage(
    requirements: string,
    packageName: string,
  ): boolean {
    if (!requirements.trim()) {
      return false;
    }

    const normalizedTarget = packageName.toLowerCase();

    return requirements
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"))
      .some((line) => {
        const normalizedLine = line
          .split(/[=<>!~\[]/, 1)[0]
          .trim()
          .toLowerCase();
        return normalizedLine === normalizedTarget;
      });
  }

  private pythonRepoNeedsPytest(fileSet: Set<string>): boolean {
    return (
      fileSet.has("pytest.ini") ||
      fileSet.has("pyproject.toml") ||
      fileSet.has("setup.cfg") ||
      fileSet.has("tests") ||
      fileSet.has("test") ||
      Array.from(fileSet).some(
        (f) =>
          f.endsWith(".py") && (f.startsWith("test_") || f.endsWith("_test.py")),
      )
    );
  }

  private detectPythonLintTargets(
    localPath: string,
    fileSet: Set<string>,
  ): string[] {
    const preferredDirs = ["src", "app", "lib"];
    const matchedDirs = preferredDirs.filter((dir) => fileSet.has(dir));
    if (matchedDirs.length > 0) {
      return matchedDirs;
    }

    const rootPyFiles = Array.from(fileSet).filter((entry) => {
      if (!entry.endsWith(".py")) {
        return false;
      }

      const absPath = path.join(localPath, entry);
      return fs.existsSync(absPath) && fs.statSync(absPath).isFile();
    });

    return rootPyFiles.length > 0 ? rootPyFiles : ["."];
  }

  private detectPythonPytestTarget(
    localPath: string,
    fileSet: Set<string>,
  ): string | undefined {
    const preferredTargets = ["tests", "test"];
    for (const target of preferredTargets) {
      if (!fileSet.has(target)) {
        continue;
      }

      const absPath = path.join(localPath, target);
      if (fs.existsSync(absPath) && fs.statSync(absPath).isDirectory()) {
        return target;
      }
    }

    return undefined;
  }

  cleanup(localPath: string): void {
    if (!localPath.startsWith(this.baseDir)) {
      logger.error(`Refusing to delete path outside base dir: ${localPath}`);
      return;
    }

    try {
      fs.rmSync(localPath, { recursive: true, force: true });
      logger.info(`Cleaned up: ${localPath}`);
    } catch (err) {
      logger.warn(`Cleanup failed for ${localPath}`, err);
    }
  }
}
