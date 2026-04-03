import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import crypto from "crypto";
import simpleGit from "simple-git";
import {
  GitHubService,
  DockerService,
  DockerTestResult,
  ShellService,
  ShellResult,
} from "./services";
import {
  RepoAnalyzerAgent,
  RepoAnalysis,
  FailureClassifierAgent,
  ClassifiedFailure,
  FixGeneratorAgent,
  GeneratedFix,
} from "./agents";
import { createLogger, config, formatAllFailuresForJudge } from "./utils";

const logger = createLogger("Orchestrator");

// ── Public types ──────────────────────────────────────────────

export type ProgressCallback = (entry: TimelineEntry) => void;

export interface OrchestratorOptions {
  repoUrl: string;
  teamName?: string;
  leaderName?: string;
  retryLimit?: number;
  dryRun?: boolean;
  onProgress?: ProgressCallback;
}

export interface FixRecord {
  file: string;
  line: number;
  bugType: string;
  error: string;
  fixApplied: boolean;
}

export interface TimelineEntry {
  timestamp: string;
  event: string;
  detail?: string;
}

export interface OrchestratorResult {
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
  status: "PASSED" | "FAILED";
  timeTaken: number;
  fixes: FixRecord[];
  timeline: TimelineEntry[];
  formattedFailures: string[];
  createdAt: string;
  pullRequestUrl?: string;
  failureDetails?: {
    category: "SETUP" | "TEST" | "PROVIDER" | "PERMISSION";
    message: string;
    failingCommand?: string;
    rawOutputExcerpt?: string;
  };
  artifact?: {
    runDirectory: string;
    workspaceDirectory: string;
    zipPath?: string;
    downloadPath?: string;
  };
}

interface SafeTestResult extends DockerTestResult {
  environmentIssue?: string;
}

interface HostRunAttempt {
  label: string;
  installCommand?: string;
  testCommand: string;
  allowFallbackOnEnvironmentIssue?: boolean;
}

// ── Orchestrator ──────────────────────────────────────────────

export class Orchestrator {
  private analyzer: RepoAnalyzerAgent;
  private classifier: FailureClassifierAgent;
  private fixer: FixGeneratorAgent;
  private docker: DockerService;
  private github: GitHubService;
  private currentProgress?: ProgressCallback;

  constructor() {
    this.analyzer = new RepoAnalyzerAgent();
    this.classifier = new FailureClassifierAgent();
    this.fixer = new FixGeneratorAgent({
      apiUrl: config.nvidia.apiUrl,
      apiKey: config.nvidia.apiKey,
    });
    this.docker = new DockerService();
    this.github = new GitHubService();

    // Build custom Docker images at startup (non-blocking, best-effort)
    this.docker.buildCustomImages().catch((err) => {
      logger.warn(`Failed to build custom Docker images: ${err}`);
    });
  }

  async run(options: OrchestratorOptions): Promise<OrchestratorResult> {
    // Store progress callback for this run
    this.currentProgress = options.onProgress;

    const startTime = Date.now();
    const runId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const timeline: TimelineEntry[] = [];
    const allFixes: FixRecord[] = [];
    let lastTestResult: SafeTestResult | null = null;
    let failureDetails: OrchestratorResult["failureDetails"];

    const teamName = options.teamName || config.teamName;
    const leaderName = options.leaderName || config.leaderName;
    const retryLimit = options.retryLimit || config.retryLimit;
    // branchName will be set after clone to the default branch

    this.addTimeline(timeline, "ORCHESTRATOR_START", `repo=${options.repoUrl}`);
    logger.info(`Orchestrator starting for ${options.repoUrl}`);
    logger.info(`Retry limit: ${retryLimit}`);

    // ── Step 1: Clone & analyse ──────────────────────────────
    this.addTimeline(timeline, "CLONE_START");
    let analysis: RepoAnalysis;
    try {
      analysis = await this.analyzer.analyze(
        options.repoUrl,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.addTimeline(timeline, "CLONE_FAILED", msg);
      return this.buildResult({
        repoUrl: options.repoUrl,
        teamName,
        leaderName,
        branchName: "unknown",
        status: "FAILED",
        startTime,
        runId,
        createdAt,
        timeline,
        allFixes,
        iterations: 0,
        failureDetails,
      });
    }
    this.addTimeline(timeline, "CLONE_DONE", `lang=${analysis.language}`);

    // Get the current default branch (main/master) - push directly to it
    const repoPath = analysis.localPath;
    const git = simpleGit(repoPath);
    await this.ensureGitRepository(repoPath);
    const currentBranch = await this.getCurrentBranchName(git);
    const branchName = currentBranch || "main";
    logger.info(`Using default branch: ${branchName}`);

    // ── Step 2–4: Retry loop ─────────────────────────────────
    let iteration = 0;
    let passed = false;
    let pullRequestUrl: string | undefined;

    while (iteration < retryLimit) {
      iteration++;
      this.addTimeline(timeline, "ITERATION_START", `#${iteration}`);
      logger.info(`──── Iteration ${iteration}/${retryLimit} ────`);

      // 2a. Run tests in Docker sandbox
      this.addTimeline(timeline, "TEST_RUN_START", `iteration=${iteration}`);
      const testResult = await this.runTestsSafe(analysis);
      lastTestResult = testResult;

      if (testResult.passed) {
        this.addTimeline(timeline, "TESTS_PASSED", `iteration=${iteration}`);
        passed = true;
        break;
      }

      if (testResult.environmentIssue) {
        failureDetails = {
          category: "SETUP",
          message: testResult.environmentIssue,
          failingCommand: analysis.installCommand,
          rawOutputExcerpt: this.createOutputExcerpt(testResult.output),
        };
        this.addTimeline(
          timeline,
          "SETUP_ERROR",
          testResult.environmentIssue,
        );
        logger.warn(`Stopping run due to setup issue: ${testResult.environmentIssue}`);
        break;
      }

      this.addTimeline(timeline, "TESTS_FAILED", `iteration=${iteration}`);
      logger.info(`Tests failed on iteration ${iteration}`);
      failureDetails = {
        category: "TEST",
        message: "Repository checks failed and AtlasOps began diagnosis.",
        failingCommand: analysis.testCommand,
        rawOutputExcerpt: this.createOutputExcerpt(testResult.output),
      };

      // 2b. Classify failures
      this.addTimeline(timeline, "CLASSIFY_START");
      const failures = this.classifier.classify(testResult.output);

      if (failures.length === 0) {
        this.addTimeline(
          timeline,
          "CLASSIFY_REGEX_MISS",
          "Regex classifier found 0 failures — falling back to LLM analysis",
        );
        logger.warn(
          "Regex classifier found 0 structured failures — using LLM fallback with raw output",
        );

        // Fallback: read all source files and let the LLM classify + fix
        const sourceFiles = this.readAllSourceFiles(
          repoPath,
          analysis.language,
          testResult.output,
        );
        if (sourceFiles.size > 0) {
          this.addTimeline(timeline, "FIX_GENERATE_START", "llm-fallback");
          const llmFixes = await this.fixer.generateFixesFromRawOutput(
            testResult.output,
            sourceFiles,
            analysis.language,
          );
          this.addTimeline(
            timeline,
            "FIX_GENERATE_DONE",
            `generated=${llmFixes.length}`,
          );

          if (llmFixes.length > 0) {
            this.addTimeline(timeline, "PATCH_APPLY_START");
            const applied = this.applyFixes(repoPath, llmFixes, allFixes);
            this.addTimeline(
              timeline,
              "PATCH_APPLY_DONE",
              `applied=${applied}`,
            );

            if (applied > 0) {
              const commitMsg = this.buildCommitMessage(llmFixes);
              await this.commitChanges(repoPath, commitMsg, branchName);
              this.addTimeline(timeline, "COMMIT", commitMsg);

              if (!options.dryRun && this.supportsRemotePush(options.repoUrl)) {
                this.addTimeline(
                  timeline,
                  "PUSH_ATTEMPT",
                  `branch=${branchName}`,
                );
                let pushSuccess = await this.pushBranch(
                  repoPath,
                  branchName,
                  options.repoUrl,
                );
                if (pushSuccess) {
                  this.addTimeline(timeline, "PUSH", `Pushed to ${branchName}`);
                } else {
                  // Fallback: push via fix branch + PR
                  this.addTimeline(
                    timeline,
                    "PUSH_FALLBACK",
                    "Trying fix branch + PR",
                  );
                  const fallback = await this.pushViaFixBranch(
                    repoPath,
                    options.repoUrl,
                    branchName,
                  );
                  if (fallback.pushed) {
                    this.addTimeline(timeline, "PUSH", "Pushed via fix branch");
                    if (fallback.prUrl) {
                      pullRequestUrl = fallback.prUrl;
                      this.addTimeline(timeline, "PR_CREATED", fallback.prUrl);
                    }
                  } else {
                    this.addTimeline(
                      timeline,
                      "PUSH_FAILED",
                      "Could not push - check token permissions",
                    );
                  }
                }
              } else if (!this.supportsRemotePush(options.repoUrl)) {
                this.addTimeline(
                  timeline,
                  "PUSH_SKIPPED",
                  "Local repository source detected - skipping remote push",
                );
              } else {
                this.addTimeline(
                  timeline,
                  "WRITEBACK_SKIPPED",
                  "Review-first mode is enabled - fixes were preserved as downloadable artifacts instead of being pushed.",
                );
              }
              continue; // try again with the fix applied
            }
          }
        }

        const providerError = this.fixer.getLastProviderError();
        if (providerError) {
          failureDetails = {
            category: "PROVIDER",
            message: providerError,
            rawOutputExcerpt: this.createOutputExcerpt(testResult.output),
          };
          this.addTimeline(timeline, "PROVIDER_ERROR", providerError);
        }

        this.addTimeline(
          timeline,
          "CLASSIFY_NO_FAILURES",
          "Could not generate fixes from raw output either",
        );
        break;
      }
      this.addTimeline(timeline, "CLASSIFY_DONE", `found=${failures.length}`);
      logger.info(`Classified ${failures.length} failure(s)`);

      // Log judge-formatted output
      const formatted = formatAllFailuresForJudge(failures);
      for (const line of formatted) {
        logger.info(`[JUDGE] ${line}`);
        this.addTimeline(timeline, "CLASSIFIED_FAILURE", line);
      }

      // 2c. Read file contents for each failing file
      const fileContents = this.readFailingFiles(repoPath, failures);

      // 2d. Generate fixes via the configured model provider
      this.addTimeline(timeline, "FIX_GENERATE_START");
      const fixes = await this.fixer.generateFixes(failures, fileContents);
      this.addTimeline(
        timeline,
        "FIX_GENERATE_DONE",
        `generated=${fixes.length}`,
      );

      if (fixes.length === 0) {
        const providerError = this.fixer.getLastProviderError();
        if (providerError) {
          failureDetails = {
            category: "PROVIDER",
            message: providerError,
            rawOutputExcerpt: this.createOutputExcerpt(testResult.output),
          };
          this.addTimeline(timeline, "PROVIDER_ERROR", providerError);
        }
        logger.warn("FixGenerator returned 0 fixes — stopping");
        this.addTimeline(timeline, "NO_FIXES_GENERATED");
        break;
      }

      // 2e. Apply patches
      this.addTimeline(timeline, "PATCH_APPLY_START");
      const applied = this.applyFixes(repoPath, fixes, allFixes);
      this.addTimeline(timeline, "PATCH_APPLY_DONE", `applied=${applied}`);

      if (applied === 0) {
        logger.warn("No patches were applied — stopping");
        break;
      }

      // 2f. Commit
      const commitMsg = this.buildCommitMessage(fixes);
      await this.commitChanges(repoPath, commitMsg, branchName);
      this.addTimeline(timeline, "COMMIT", commitMsg);

      // 2g. Push (unless dry-run)
      if (!options.dryRun && this.supportsRemotePush(options.repoUrl)) {
        this.addTimeline(timeline, "PUSH_ATTEMPT", `branch=${branchName}`);
        let pushSuccess = await this.pushBranch(
          repoPath,
          branchName,
          options.repoUrl,
        );

        if (pushSuccess) {
          this.addTimeline(timeline, "PUSH", `Pushed to ${branchName}`);
        } else {
          // Fallback: push via fix branch + PR
          this.addTimeline(
            timeline,
            "PUSH_FALLBACK",
            "Push to main failed - trying fix branch + PR",
          );
          const fallback = await this.pushViaFixBranch(
            repoPath,
            options.repoUrl,
            branchName,
          );
          pushSuccess = fallback.pushed;
          if (fallback.pushed) {
            this.addTimeline(timeline, "PUSH", "Pushed via fix branch");
            if (fallback.prUrl) {
              pullRequestUrl = fallback.prUrl;
              this.addTimeline(timeline, "PR_CREATED", fallback.prUrl);
            }
          } else {
            failureDetails = {
              category: "PERMISSION",
              message:
                "AtlasOps generated fixes, but the configured GitHub token could not push them to the target repository.",
              rawOutputExcerpt: this.createOutputExcerpt(
                lastTestResult?.output ?? "",
              ),
            };
            this.addTimeline(
              timeline,
              "PUSH_FAILED",
              "Could not push - check token permissions",
            );
          }
        }

        if (pushSuccess) {
          // 2h. Wait for CI and check result (only if push succeeded)
          this.addTimeline(timeline, "CI_MONITOR_START");
          const ciPassed = await this.monitorCI(branchName);
          this.addTimeline(timeline, ciPassed ? "CI_PASSED" : "CI_FAILED");

          if (ciPassed) {
            passed = true;
            break;
          }
        }
      } else if (!this.supportsRemotePush(options.repoUrl)) {
        this.addTimeline(
          timeline,
          "PUSH_SKIPPED",
          "Local repository source detected - skipping remote push",
        );
      } else {
        this.addTimeline(
          timeline,
          "WRITEBACK_SKIPPED",
          "Review-first mode is enabled - fixes were preserved as downloadable artifacts instead of being pushed.",
        );
      }
    }

    // PR URL may have been set during push fallback
    // (If push to main succeeded directly, no PR is needed)

    const status = passed ? "PASSED" : "FAILED";
    this.addTimeline(timeline, "ORCHESTRATOR_DONE", status);

    // ── Write results.json ───────────────────────────────────
    const result = this.buildResult({
      repoUrl: options.repoUrl,
      teamName,
      leaderName,
      branchName,
      status,
      startTime,
      runId,
      createdAt,
      timeline,
      allFixes,
      iterations: iteration,
      pullRequestUrl,
      failureDetails,
    });

    result.artifact = this.persistRunArtifacts(result, repoPath);
    result.writebackEnabled =
      !options.dryRun && this.supportsRemotePush(options.repoUrl);
    this.writeResultsJson(result);
    logger.info(`Finished: ${status} after ${iteration} iteration(s)`);

    // Cleanup clone
    try {
      this.analyzer.cleanup(repoPath);
    } catch {
      /* best-effort */
    }

    // Clear progress callback
    this.currentProgress = undefined;

    return result;
  }

  // ── Branch helpers ─────────────────────────────────────────

  private buildBranchName(teamName: string, leaderName: string): string {
    const sanitize = (s: string) =>
      s
        .toUpperCase()
        .replace(/[^A-Z\s]/g, "") // strip numbers + special chars, keep spaces
        .trim()
        .replace(/\s+/g, "_") // spaces → single underscore
        .replace(/_+/g, "_") // collapse multiple underscores
        .replace(/^_|_$/g, ""); // trim leading/trailing underscores

    const team = sanitize(teamName);
    const leader = sanitize(leaderName);

    if (!team || !leader) {
      throw new Error(
        `Invalid branch naming inputs: teamName="${teamName}", leaderName="${leaderName}"`,
      );
    }

    return `${team}_${leader}_AI_Fix`;
  }

  private async prepareBranch(
    repoPath: string,
    branchName: string,
  ): Promise<void> {
    const git = simpleGit(repoPath);

    try {
      await git.checkout(branchName);
      logger.info(`Checked out existing branch: ${branchName}`);
    } catch {
      await git.checkoutLocalBranch(branchName);
      logger.info(`Created new branch: ${branchName}`);
    }
  }

  // ── Test runner ────────────────────────────────────────────

  private async runTestsSafe(
    analysis: RepoAnalysis,
  ): Promise<SafeTestResult> {
    const dockerAvailable = await this.docker.isDockerAvailable();

    if (dockerAvailable) {
      const result = await this.docker.runTests(
        analysis.localPath,
        analysis.language,
        analysis.installCommand,
        analysis.testCommand,
      );
      return {
        ...result,
        environmentIssue:
          this.detectEnvironmentIssue(result.output) || undefined,
      };
    }

    // Fallback: run directly via shell (Railway may use Docker-in-Docker)
    logger.warn("Docker not available — running tests directly via shell");
    const shell = new ShellService();
    const attempts = await this.buildHostRunAttempts(analysis, shell);
    let lastResult: SafeTestResult | null = null;

    for (const attempt of attempts) {
      logger.info(`Host execution strategy: ${attempt.label}`);
      const startTime = Date.now();

      const installResult = attempt.installCommand
        ? await shell.run(attempt.installCommand, analysis.localPath, 120_000)
        : this.createSuccessfulShellResult();
      const testResult = await shell.run(
        attempt.testCommand,
        analysis.localPath,
        120_000,
      );
      const executionTime = Date.now() - startTime;
      const output = this.combineShellOutput(installResult, testResult);
      const environmentIssue =
        this.detectEnvironmentIssue(
          output,
          installResult.exitCode,
          testResult.exitCode,
        ) || undefined;

      const candidate: SafeTestResult = {
        passed: testResult.exitCode === 0,
        output,
        executionTime,
        containerId: `host:${attempt.label}`,
        environmentIssue,
      };

      if (candidate.passed) {
        return candidate;
      }

      lastResult = candidate;

      if (!environmentIssue || !attempt.allowFallbackOnEnvironmentIssue) {
        return candidate;
      }
    }

    return (
      lastResult ?? {
        passed: false,
        output: "Host execution failed before tests could run.",
        executionTime: 0,
        containerId: "host",
        environmentIssue:
          "Host execution failed before tests could run.",
      }
    );
  }

  private detectEnvironmentIssue(
    output: string,
    installExitCode?: number,
    testExitCode?: number,
  ): string | null {
    const normalized = output.toLowerCase();

    if (
      normalized.includes("temporary failure in name resolution") ||
      normalized.includes("failed to establish a new connection") ||
      normalized.includes("could not resolve host") ||
      normalized.includes("network is unreachable") ||
      normalized.includes("connection timed out") ||
      normalized.includes("read timed out") ||
      normalized.includes("ssl: certificate_verify_failed") ||
      normalized.includes("could not fetch url") ||
      normalized.includes("failed to fetch") ||
      normalized.includes("newconnectionerror")
    ) {
      return "Dependency installation failed because the local environment could not reach external package registries.";
    }

    if (
      normalized.includes("no module named pytest") ||
      normalized.includes("no module named flake8") ||
      normalized.includes("no module named pip") ||
      normalized.includes("ensurepip is not available") ||
      normalized.includes("externally-managed-environment") ||
      normalized.includes("venv creation failed") ||
      normalized.includes("npm: command not found") ||
      normalized.includes("python3: command not found") ||
      normalized.includes("python: command not found") ||
      normalized.includes("node: command not found")
    ) {
      if (installExitCode && installExitCode !== 0) {
        return "Dependency bootstrap failed, so the isolated test environment could not install the required test tooling.";
      }
      return "Required local tooling is missing. Install the project runtime and test tools before running AtlasOps.";
    }

    if (installExitCode && installExitCode !== 0) {
      return "Dependency installation failed before tests could run. Resolve the local setup issue and rerun.";
    }

    if (
      testExitCode &&
      testExitCode !== 0 &&
      (normalized.includes("no tests ran") || normalized.includes("collected 0 items")) &&
      !(
        normalized.includes("syntaxerror") ||
        normalized.includes("indentationerror") ||
        normalized.includes("taberror") ||
        normalized.includes("importerror") ||
        normalized.includes("modulenotfounderror") ||
        normalized.includes("error collecting") ||
        normalized.includes("traceback") ||
        normalized.includes("assertionerror") ||
        normalized.includes("failed")
      )
    ) {
      return "The detected test command did not execute a valid test suite.";
    }

    return null;
  }

  private async buildHostRunAttempts(
    analysis: RepoAnalysis,
    shell: ShellService,
  ): Promise<HostRunAttempt[]> {
    if (analysis.language === "python") {
      return this.buildPythonHostRunAttempts(analysis, shell);
    }

    if (analysis.language === "node") {
      return this.buildNodeHostRunAttempts(analysis);
    }

    return [
      {
        label: "direct",
        installCommand: analysis.installCommand,
        testCommand: analysis.testCommand,
      },
    ];
  }

  private async buildPythonHostRunAttempts(
    analysis: RepoAnalysis,
    shell: ShellService,
  ): Promise<HostRunAttempt[]> {
    const attempts: HostRunAttempt[] = [];

    if (
      this.pythonRepoCanUseGlobalTooling(analysis.localPath) &&
      (await this.pythonToolsAvailableGlobally(shell, analysis.testCommand))
    ) {
      attempts.push({
        label: "python-global-tools",
        testCommand: analysis.testCommand,
        allowFallbackOnEnvironmentIssue: true,
      });
    }

    const hostCommands = this.prepareHostCommands(analysis);
    attempts.push({
      label: "python-isolated-venv",
      installCommand: hostCommands.installCommand,
      testCommand: hostCommands.testCommand,
    });

    return attempts;
  }

  private buildNodeHostRunAttempts(
    analysis: RepoAnalysis,
  ): HostRunAttempt[] {
    const attempts: HostRunAttempt[] = [
      {
        label: "node-install-and-test",
        installCommand: analysis.installCommand,
        testCommand: analysis.testCommand,
      },
    ];

    if (fs.existsSync(path.join(analysis.localPath, "node_modules"))) {
      attempts.unshift({
        label: "node-vendored-modules",
        testCommand: analysis.testCommand,
        allowFallbackOnEnvironmentIssue: true,
      });
    }

    return attempts;
  }

  private pythonRepoCanUseGlobalTooling(repoPath: string): boolean {
    const requirementsPath = path.join(repoPath, "requirements.txt");
    if (!fs.existsSync(requirementsPath)) {
      return true;
    }

    try {
      const content = fs.readFileSync(requirementsPath, "utf-8");
      const declaredPackages = content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith("#"))
        .map((line) => line.split(/[=<>!~\[]/, 1)[0].trim().toLowerCase());

      return declaredPackages.every((pkg) =>
        ["pytest", "flake8"].includes(pkg),
      );
    } catch {
      return false;
    }
  }

  private async pythonToolsAvailableGlobally(
    shell: ShellService,
    command: string,
  ): Promise<boolean> {
    const modules = Array.from(
      new Set(
        [...command.matchAll(/python3\s+-m\s+([a-zA-Z0-9_]+)/g)].map(
          (match) => match[1],
        ),
      ),
    );

    if (modules.length === 0) {
      return true;
    }

    for (const moduleName of modules) {
      const result = await shell.run(`python3 -m ${moduleName} --version`, undefined, 15_000);
      if (result.exitCode !== 0) {
        return false;
      }
    }

    return true;
  }

  private createSuccessfulShellResult(): ShellResult {
    return {
      stdout: "",
      stderr: "",
      exitCode: 0,
    };
  }

  private combineShellOutput(
    installResult: ShellResult,
    testResult: ShellResult,
  ): string {
    return [
      installResult.stdout,
      installResult.stderr,
      testResult.stdout,
      testResult.stderr,
    ]
      .filter(Boolean)
      .join("\n");
  }

  private prepareHostCommands(
    analysis: RepoAnalysis,
  ): { installCommand: string; testCommand: string } {
    if (analysis.language !== "python") {
      return {
        installCommand: analysis.installCommand,
        testCommand: analysis.testCommand,
      };
    }

    const venvDir = path.join(
      os.tmpdir(),
      `atlasops-venv-${path.basename(analysis.localPath)}`,
    );
    const venvPython = `${venvDir}/bin/python`;
    const bootstrap = `python3 -m venv ${venvDir} && ${venvPython} -m pip install --upgrade pip`;

    return {
      installCommand: `${bootstrap} && ${this.rewritePythonCommandForHostVenv(analysis.installCommand, venvPython)}`,
      testCommand: this.rewritePythonCommandForHostVenv(
        analysis.testCommand,
        venvPython,
      ),
    };
  }

  private rewritePythonCommandForHostVenv(
    command: string,
    venvPython: string,
  ): string {
    return command
      .replace(/python3 -m pip/g, `${venvPython} -m pip`)
      .replace(/python3 -m pytest/g, `${venvPython} -m pytest`)
      .replace(/python3 -m flake8/g, `${venvPython} -m flake8`)
      .replace(/(^|&&\s*)python3\s+([^\s].*?\.py)(?=$|\s*&&)/g, `$1${venvPython} $2`);
  }

  // ── File I/O ───────────────────────────────────────────────

  private readAllSourceFiles(
    repoPath: string,
    language: string,
    rawOutput?: string,
  ): Map<string, string> {
    const contents = new Map<string, string>();
    const extensions =
      language === "python"
        ? [".py"]
        : language === "node"
          ? [".js", ".ts", ".mjs", ".cjs", ".jsx", ".tsx"]
          : [".py", ".js", ".ts"];

    try {
      const files = fs.readdirSync(repoPath, { recursive: true }).map(String);
      const relevantFiles = this.rankRelevantSourceFiles(
        files,
        language,
        rawOutput,
      );
      for (const rel of relevantFiles) {
        if (
          rel.includes("node_modules") ||
          rel.includes("__pycache__") ||
          rel.includes(".git")
        )
          continue;
        if (!extensions.some((ext) => rel.endsWith(ext))) continue;
        try {
          const absPath = path.join(repoPath, rel);
          const content = fs.readFileSync(absPath, "utf-8");
          contents.set(rel, content);
        } catch {
          /* skip unreadable */
        }
      }
    } catch {
      logger.warn(`Could not scan source files in ${repoPath}`);
    }

    return contents;
  }

  private readFailingFiles(
    repoPath: string,
    failures: ClassifiedFailure[],
  ): Map<string, string> {
    const contents = new Map<string, string>();

    for (const failure of failures) {
      if (contents.has(failure.file)) continue;

      const absPath = path.isAbsolute(failure.file)
        ? failure.file
        : path.join(repoPath, failure.file);

      try {
        const content = fs.readFileSync(absPath, "utf-8");
        contents.set(failure.file, content);
      } catch {
        logger.warn(`Could not read file: ${absPath}`);
      }
    }

    for (const supportFile of ["package.json", "requirements.txt"]) {
      const absPath = path.join(repoPath, supportFile);
      if (!fs.existsSync(absPath)) continue;
      if (contents.has(supportFile)) continue;

      try {
        const content = fs.readFileSync(absPath, "utf-8");
        contents.set(supportFile, content);
      } catch {
        logger.warn(`Could not read support file: ${absPath}`);
      }
    }

    return contents;
  }

  private applyFixes(
    repoPath: string,
    fixes: GeneratedFix[],
    allFixes: FixRecord[],
  ): number {
    let applied = 0;

    for (const fix of fixes) {
      const absPath = path.isAbsolute(fix.file)
        ? fix.file
        : path.join(repoPath, fix.file);

      try {
        fs.writeFileSync(absPath, fix.correctedContent, "utf-8");
        applied++;

        allFixes.push({
          file: fix.file,
          line: fix.line,
          bugType: fix.originalError,
          error: fix.originalError,
          fixApplied: true,
        });

        logger.info(`Patched: ${fix.file}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`Failed to write fix to ${fix.file}: ${msg}`);

        allFixes.push({
          file: fix.file,
          line: fix.line,
          bugType: fix.originalError,
          error: msg,
          fixApplied: false,
        });
      }
    }

    return applied;
  }

  // ── Git helpers ────────────────────────────────────────────

  private buildCommitMessage(fixes: GeneratedFix[]): string {
    const descriptions = fixes
      .map((f) => `${path.basename(f.file)}:${f.line}`)
      .join(", ");
    return `[AtlasOps] Fix: ${descriptions}`;
  }

  private supportsRemotePush(repoUrl: string): boolean {
    return /^https?:\/\//i.test(repoUrl) || /^git@/i.test(repoUrl);
  }

  private async ensureGitRepository(repoPath: string): Promise<void> {
    const git = simpleGit(repoPath);
    this.ensureTransientGitignore(repoPath);

    try {
      await git.revparse(["--is-inside-work-tree"]);
    } catch {
      logger.warn(`No git repository detected at ${repoPath} - initializing`);
      await git.init();
      await git.addConfig("user.name", "AtlasOps");
      await git.addConfig("user.email", "atlasops@local.dev");
    }
  }

  private ensureTransientGitignore(repoPath: string): void {
    const ignorePath = path.join(repoPath, ".gitignore");
    const requiredEntries = [
      "node_modules/",
      ".atlasops-venv/",
      ".pytest_cache/",
      "__pycache__/",
      "*.pyc",
    ];

    let current = "";
    if (fs.existsSync(ignorePath)) {
      current = fs.readFileSync(ignorePath, "utf-8");
    }

    const missingEntries = requiredEntries.filter(
      (entry) => !current.includes(entry),
    );

    if (missingEntries.length === 0) {
      return;
    }

    const prefix = current.length > 0 && !current.endsWith("\n") ? "\n" : "";
    const block = `${prefix}${missingEntries.join("\n")}\n`;
    fs.writeFileSync(ignorePath, `${current}${block}`, "utf-8");
  }

  private async getCurrentBranchName(
    git: ReturnType<typeof simpleGit>,
  ): Promise<string> {
    try {
      return (await git.revparse(["--abbrev-ref", "HEAD"])).trim();
    } catch {
      return "main";
    }
  }

  private async commitChanges(
    repoPath: string,
    message: string,
    branch: string,
  ): Promise<boolean> {
    const git = simpleGit(repoPath);
    await git.addConfig("user.name", "AtlasOps");
    await git.addConfig("user.email", "atlasops@local.dev");

    // Check if there are changes to commit
    const status = await git.status();
    logger.info(
      `Git status: modified=${status.modified.length}, created=${status.created.length}, deleted=${status.deleted.length}, not_added=${status.not_added.length}`,
    );

    if (
      status.modified.length === 0 &&
      status.created.length === 0 &&
      status.deleted.length === 0 &&
      status.not_added.length === 0
    ) {
      logger.warn("No changes detected in working tree - nothing to commit");
      return false;
    }

    await git.add(".");

    try {
      const commitResult = await git.commit(message);
      logger.info(`Committed: ${message} (${commitResult.commit})`);
      return true;
    } catch (err) {
      logger.warn(`Commit failed: ${err instanceof Error ? err.message : err}`);
      return false;
    }
  }

  private async injectTokenIntoRemote(
    git: ReturnType<typeof simpleGit>,
    repoUrl: string,
  ): Promise<string | null> {
    const token = config.github.token;
    if (!token) {
      logger.error("No GitHub token provided - cannot push");
      return null;
    }

    try {
      // Build auth URL manually to avoid URL encoding issues with tokens
      const cleanUrl = repoUrl.replace(/\.git$/, "").trim();
      const match = cleanUrl.match(/github\.com[\/:]([^\/]+)\/([^\/]+)/);
      if (match) {
        const [, owner, repo] = match;
        const authUrl = `https://x-access-token:${token}@github.com/${owner}/${repo}.git`;
        await git.remote(["set-url", "origin", authUrl]);
        logger.info(`Injected token into remote URL for ${owner}/${repo}`);
      } else {
        // Fallback: try URL constructor
        const url = new URL(repoUrl);
        if (url.hostname === "github.com") {
          url.username = "x-access-token";
          url.password = token;
          await git.remote(["set-url", "origin", url.toString()]);
          logger.info("Injected token into remote URL (URL fallback)");
        }
      }
    } catch (err) {
      logger.warn(`Could not inject token into remote URL: ${err}`);
    }

    return token;
  }

  private async pushBranch(
    repoPath: string,
    branch: string,
    repoUrl: string,
  ): Promise<boolean> {
    const git = simpleGit(repoPath);

    const token = await this.injectTokenIntoRemote(git, repoUrl);
    if (!token) return false;

    try {
      // Log what we're about to push
      const status = await git.status();
      const log = await git.log({ maxCount: 1 });
      logger.info(
        `Git status before push: clean=${status.isClean()}, staged=${status.staged.length}, branch=${status.current}`,
      );
      logger.info(
        `Latest commit: ${log.latest?.hash?.substring(0, 7)} - ${log.latest?.message}`,
      );

      const pushResult = await git.push("origin", branch, [
        "--set-upstream",
        "--force",
      ]);
      logger.info(`Push result: ${JSON.stringify(pushResult)}`);
      logger.info(`Pushed to branch: ${branch}`);
      return true;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.error(`Failed to push to ${branch}: ${errMsg}`);
      // Log common failure reasons
      if (errMsg.includes("403") || errMsg.includes("Permission")) {
        logger.error("Token lacks push permission. Ensure token has 'repo' or 'Contents: Read and write' scope.");
      } else if (errMsg.includes("401") || errMsg.includes("Authentication")) {
        logger.error("Authentication failed. Check if your GitHub token is valid and not expired.");
      } else if (errMsg.includes("404")) {
        logger.error("Repository not found. Check the repo URL and token access.");
      }
      return false;
    }
  }

  /**
   * Fallback: create a fix branch, push it, then create a PR
   */
  private async pushViaFixBranch(
    repoPath: string,
    repoUrl: string,
    defaultBranch: string,
  ): Promise<{ pushed: boolean; prUrl?: string }> {
    const git = simpleGit(repoPath);
    const fixBranch = `fix/atlasops-${Date.now()}`;

    try {
      // Create fix branch from current HEAD
      await git.checkoutLocalBranch(fixBranch);
      logger.info(`Created fix branch: ${fixBranch}`);
    } catch {
      try {
        await git.checkout(fixBranch);
      } catch {
        logger.error(`Could not create fix branch ${fixBranch}`);
        return { pushed: false };
      }
    }

    const token = await this.injectTokenIntoRemote(git, repoUrl);
    if (!token) {
      // Switch back to default branch before returning
      try {
        await git.checkout(defaultBranch);
      } catch {
        /* best-effort */
      }
      return { pushed: false };
    }

    try {
      await git.push("origin", fixBranch, ["--set-upstream", "--force"]);
      logger.info(`Pushed fix branch: ${fixBranch}`);
    } catch (err) {
      logger.error(
        `Failed to push fix branch: ${err instanceof Error ? err.message : err}`,
      );
      // Switch back to default branch before returning
      try {
        await git.checkout(defaultBranch);
      } catch {
        /* best-effort */
      }
      return { pushed: false };
    }

    // Create PR from fix branch to default branch
    const prResult = await this.github.createPullRequest({
      repoUrl,
      branch: fixBranch,
      title: `[AtlasOps] Automated remediation candidate`,
      body: `Automated remediation prepared by AtlasOps.\n\nFix branch: \`${fixBranch}\``,
      token: config.github.token || undefined,
    });

    // Switch back to default branch for next iteration
    try {
      await git.checkout(defaultBranch);
      logger.info(`Switched back to ${defaultBranch}`);
    } catch {
      /* best-effort */
    }

    if (prResult) {
      logger.info(`PR created: ${prResult.url}`);
      return { pushed: true, prUrl: prResult.url };
    } else {
      logger.warn("Fix branch pushed but PR creation failed");
      return { pushed: true };
    }
  }

  // ── CI monitor ─────────────────────────────────────────────

  private async monitorCI(branch: string): Promise<boolean> {
    logger.info(`Monitoring GitHub Actions CI for branch: ${branch}`);

    const maxPolls = 6; // 6 polls x 5 sec = 30 sec max
    const pollIntervalMs = 5_000;

    for (let i = 0; i < maxPolls; i++) {
      await this.sleep(pollIntervalMs);

      try {
        const runs = await this.github.getLatestWorkflowRuns(10);
        const branchRun = runs.find(
          (r) => r.status === "completed" && r.html_url.includes(branch),
        );

        if (branchRun) {
          if (branchRun.conclusion === "success") {
            logger.info(`CI passed for branch ${branch}`);
            return true;
          }
          if (branchRun.conclusion === "failure") {
            logger.info(`CI failed for branch ${branch}`);
            return false;
          }
        }

        logger.info(`CI poll ${i + 1}/${maxPolls} — still running...`);
      } catch (err) {
        logger.warn(
          `CI poll error: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    logger.warn(`CI monitoring timed out after ${maxPolls} polls`);
    return false;
  }

  // ── Results ────────────────────────────────────────────────

  private buildResult(params: {
    repoUrl: string;
    teamName: string;
    leaderName: string;
    branchName: string;
    status: "PASSED" | "FAILED";
    startTime: number;
    runId: string;
    createdAt: string;
    timeline: TimelineEntry[];
    allFixes: FixRecord[];
    iterations: number;
    pullRequestUrl?: string;
    failureDetails?: OrchestratorResult["failureDetails"];
  }): OrchestratorResult {
    // Extract judge-formatted failures from timeline
    const formattedFailures = params.timeline
      .filter((t) => t.event === "CLASSIFIED_FAILURE" && t.detail)
      .map((t) => t.detail!);

    return {
      id: params.runId,
      repository: params.repoUrl,
      repositorySource: this.supportsRemotePush(params.repoUrl)
        ? "remote"
        : "local",
      writebackEnabled: false,
      teamName: params.teamName,
      leaderName: params.leaderName,
      branch: params.branchName,
      totalFailures: params.allFixes.length,
      totalFixes: params.allFixes.filter((f) => f.fixApplied).length,
      iterations: params.iterations,
      status: params.status,
      timeTaken: Date.now() - params.startTime,
      fixes: params.allFixes,
      timeline: params.timeline,
      formattedFailures,
      createdAt: params.createdAt,
      pullRequestUrl: params.pullRequestUrl,
      failureDetails: params.failureDetails,
    };
  }

  private rankRelevantSourceFiles(
    files: string[],
    language: string,
    rawOutput?: string,
  ): string[] {
    const extensions =
      language === "python"
        ? [".py"]
        : language === "node"
          ? [".js", ".ts", ".mjs", ".cjs", ".jsx", ".tsx"]
          : [".py", ".js", ".ts"];

    const sourceFiles = files.filter((rel) => extensions.some((ext) => rel.endsWith(ext)));
    if (!rawOutput) {
      return sourceFiles.slice(0, 6);
    }

    const normalizedOutput = rawOutput.replace(/\\/g, "/");
    const scored = sourceFiles.map((rel) => {
      let score = 0;
      const normalizedRel = rel.replace(/\\/g, "/");
      const base = path.basename(rel);

      if (normalizedOutput.includes(normalizedRel)) score += 6;
      if (normalizedOutput.includes(base)) score += 4;
      if (/test|spec/i.test(rel)) score += 1;
      if (/src|app|lib|components|pages/i.test(rel)) score += 1;

      return { rel, score };
    });

    return scored
      .sort((a, b) => b.score - a.score || a.rel.localeCompare(b.rel))
      .slice(0, 6)
      .map((item) => item.rel);
  }

  private createOutputExcerpt(output: string): string | undefined {
    const normalized = output.trim();
    if (!normalized) {
      return undefined;
    }

    const compact = normalized.split(/\r?\n/).slice(-20).join("\n").trim();
    return compact.length > 1600 ? `${compact.slice(0, 1600)}…` : compact;
  }

  private writeResultsJson(result: OrchestratorResult): void {
    const latestResultsPath = path.resolve(process.cwd(), "results.json");
    const runsDir = path.resolve(process.cwd(), "artifacts", "runs");
    const repoSlug = path.basename(result.repository).replace(/[^a-zA-Z0-9_-]/g, "_");
    const artifactPath = path.join(
      runsDir,
      `${new Date().toISOString().replace(/[:.]/g, "-")}-${repoSlug}.json`,
    );

    try {
      fs.mkdirSync(runsDir, { recursive: true });
      const payload = JSON.stringify(result, null, 2);
      fs.writeFileSync(latestResultsPath, payload, "utf-8");
      fs.writeFileSync(artifactPath, payload, "utf-8");
      logger.info(`Results written to ${latestResultsPath}`);
      logger.info(`Run artifact written to ${artifactPath}`);
    } catch (err) {
      logger.error(`Failed to write results.json: ${err}`);
    }
  }

  private persistRunArtifacts(
    result: OrchestratorResult,
    repoPath: string,
  ): OrchestratorResult["artifact"] {
    const runDir = path.resolve(process.cwd(), "artifacts", "runs", result.id);
    const workspaceDir = path.join(runDir, "workspace");
    const zipPath = path.join(runDir, `${result.id}.zip`);
    const resultPath = path.join(runDir, "result.json");

    try {
      fs.mkdirSync(runDir, { recursive: true });
      this.copyWorkspaceForArtifact(repoPath, workspaceDir);

      let downloadPath: string | undefined;
      try {
        this.createZipArtifact(workspaceDir, zipPath);
        downloadPath = `/api/runs/${result.id}/download`;
      } catch (err) {
        logger.warn(
          `Failed to create zip artifact for run ${result.id}: ${err instanceof Error ? err.message : err}`,
        );
      }

      const artifact = {
        runDirectory: runDir,
        workspaceDirectory: workspaceDir,
        zipPath: fs.existsSync(zipPath) ? zipPath : undefined,
        downloadPath,
      };
      result.artifact = artifact;
      fs.writeFileSync(resultPath, JSON.stringify(result, null, 2), "utf-8");
      return artifact;
    } catch (err) {
      logger.error(
        `Failed to persist run artifacts for ${result.id}: ${err instanceof Error ? err.message : err}`,
      );
      return undefined;
    }
  }

  private copyWorkspaceForArtifact(sourcePath: string, targetPath: string): void {
    if (fs.existsSync(targetPath)) {
      fs.rmSync(targetPath, { recursive: true, force: true });
    }

    fs.cpSync(sourcePath, targetPath, {
      recursive: true,
      force: true,
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
  }

  private createZipArtifact(workspaceDir: string, zipPath: string): void {
    execFileSync("zip", ["-qr", zipPath, "."], {
      cwd: workspaceDir,
      stdio: "ignore",
    });
  }

  private buildPRBody(fixes: FixRecord[], passed: boolean): string {
    const fixList = fixes
      .filter((f) => f.fixApplied)
      .map((f) => `- **${f.file}:${f.line}** - ${f.bugType}: ${f.error}`)
      .join("\n");

    return `## AtlasOps - Automated Remediation Report

This pull request was automatically generated by AtlasOps.

### Status: ${passed ? "✅ Tests Passing" : "⚠️ Tests Still Failing"}

### Fixes Applied (${fixes.filter((f) => f.fixApplied).length}):
${fixList || "No fixes were applied."}

---
*Generated by AtlasOps*`;
  }

  // ── Utilities ──────────────────────────────────────────────

  private addTimeline(
    timeline: TimelineEntry[],
    event: string,
    detail?: string,
  ): void {
    const entry: TimelineEntry = {
      timestamp: new Date().toISOString(),
      event,
      detail,
    };
    timeline.push(entry);
    if (this.currentProgress) {
      this.currentProgress(entry);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
