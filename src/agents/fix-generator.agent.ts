import axios from "axios";
import { createLogger } from "../utils";
import { ClassifiedFailure } from "./failure-classifier.agent";

const logger = createLogger("FixGenerator");

const MAX_LLM_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 1_500;

export interface FixGeneratorConfig {
  apiUrl: string;
  apiKey: string;
}

export interface GeneratedFix {
  file: string;
  line: number;
  originalError: string;
  correctedContent: string;
}

class ProviderApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ProviderApiError";
    this.status = status;
  }
}

const SYSTEM_PROMPT =
  "You are an AI software remediation assistant. Return only corrected file content. " +
  "Do not include any explanation, commentary, markdown fences, or triple backticks. " +
  "Output ONLY the raw file content ready to be saved directly to disk. " +
  "IMPORTANT: Python stops at the first SyntaxError, so the error output may only show one bug. " +
  "You MUST proactively read the ENTIRE source code and fix ALL bugs — syntax errors, typos, " +
  "type mismatches, missing colons, wrong variable names, incorrect operations — not just the one shown in the error output.";

function loadFixGeneratorConfig(): FixGeneratorConfig {
  const apiUrl = process.env.NVIDIA_API_URL;
  const apiKey = process.env.NVIDIA_API_KEY;

  if (!apiUrl || !apiKey) {
    throw new Error(
      "Missing NVIDIA_API_URL or NVIDIA_API_KEY environment variables",
    );
  }

  return { apiUrl, apiKey };
}

export class FixGeneratorAgent {
  private config: FixGeneratorConfig;
  private lastProviderError: string | null = null;

  constructor(config?: FixGeneratorConfig) {
    this.config = config ?? loadFixGeneratorConfig();
  }

  async generateFix(
    failure: ClassifiedFailure,
    fileContent: string,
  ): Promise<GeneratedFix> {
    logger.info(
      `Generating fix for ${failure.bugType} in ${failure.file}:${failure.line}`,
    );

    const userPrompt = this.buildPrompt(failure, fileContent);
    const correctedContent = await this.callApiWithRetry(
      userPrompt,
      fileContent,
    );

    return {
      file: failure.file,
      line: failure.line,
      originalError: failure.errorMessage,
      correctedContent,
    };
  }

  async generateFixes(
    failures: ClassifiedFailure[],
    fileContents: Map<string, string>,
  ): Promise<GeneratedFix[]> {
    this.lastProviderError = null;
    const fixes: GeneratedFix[] = [];
    const handledFiles = new Set<string>();

    for (const failure of failures) {
      if (handledFiles.has(failure.file)) {
        continue;
      }

      const relatedFailures = failures.filter((item) => item.file === failure.file);
      const deterministicFix = this.tryGenerateDeterministicFix(
        failure,
        fileContents,
        relatedFailures,
      );
      if (deterministicFix) {
        fixes.push(deterministicFix);
        handledFiles.add(failure.file);
        continue;
      }

      const content = fileContents.get(failure.file);
      if (!content) {
        logger.warn(`No file content available for ${failure.file}, skipping`);
        continue;
      }

      if (!this.hasUsableProvider()) {
        logger.warn(
          `Skipping model-generated fix for ${failure.file} because the provider is not configured`,
        );
        continue;
      }

      try {
        const fix = await this.generateFix(failure, content);
        fixes.push(fix);
        handledFiles.add(failure.file);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.lastProviderError = msg;
        logger.error(`Failed to generate fix for ${failure.file}: ${msg}`);
      }
    }

    logger.info(`Generated ${fixes.length}/${failures.length} fix(es)`);
    return fixes;
  }

  /**
   * Fallback: when the regex classifier can't parse failures,
   * send the raw test output + all source files to the LLM and
   * ask it to fix each file.
   */
  async generateFixesFromRawOutput(
    rawTestOutput: string,
    sourceFiles: Map<string, string>,
    language: string,
  ): Promise<GeneratedFix[]> {
    this.lastProviderError = null;
    if (!this.hasUsableProvider()) {
      logger.warn(
        "Skipping raw-output fallback because the model provider is not configured",
      );
      this.lastProviderError =
        "The model provider is not configured, so AtlasOps could not generate an AI remediation draft.";
      return [];
    }

    logger.info(
      `LLM fallback: sending raw output + ${sourceFiles.size} source file(s) to fix`,
    );
    const fixes: GeneratedFix[] = [];

    for (const [filePath, content] of sourceFiles) {
      const prompt = [
        `Language: ${language}`,
        `File: ${filePath}`,
        "",
        "Test / execution output (may only show the FIRST error — Python stops at the first SyntaxError):",
        rawTestOutput,
        "",
        `Current content of ${filePath}:`,
        content,
        "",
        "CRITICAL INSTRUCTIONS:",
        "1. Fix ALL errors in this file — not just the one shown in the test output.",
        "2. Python only reports the first SyntaxError, so there may be MORE bugs hiding after it.",
        "3. Read every line of the source carefully. Fix syntax errors, typos, type mismatches,",
        "   missing colons, wrong variable names, incorrect string/int operations, etc.",
        "4. Return ONLY the corrected file content — no markdown fences, no backticks, no commentary.",
        "5. Output raw file content ONLY.",
      ].join("\n");

      try {
        const corrected = await this.callApiWithRetry(prompt, content);
        // Only add if the LLM actually changed the content
        if (corrected.trim() !== content.trim()) {
          fixes.push({
            file: filePath,
            line: 1,
            originalError: "Detected from raw test output",
            correctedContent: corrected,
          });
          logger.info(`LLM generated fix for ${filePath}`);
        } else {
          logger.info(`LLM returned unchanged content for ${filePath}`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.lastProviderError = msg;
        logger.error(`LLM fallback failed for ${filePath}: ${msg}`);
      }
    }

    logger.info(`LLM fallback generated ${fixes.length} fix(es)`);
    return fixes;
  }

  private buildPrompt(failure: ClassifiedFailure, fileContent: string): string {
    return [
      `File: ${failure.file}`,
      `Error type: ${failure.bugType}`,
      `Line: ${failure.line}`,
      `Error: ${failure.errorMessage}`,
      "",
      "Current file content:",
      fileContent,
      "",
      "Return ONLY the corrected file content.",
      "Do NOT include markdown fences, triple backticks, explanations, or any commentary.",
      "Output raw file content ONLY.",
    ].join("\n");
  }

  getLastProviderError(): string | null {
    return this.lastProviderError;
  }

  private tryGenerateDeterministicFix(
    failure: ClassifiedFailure,
    fileContents: Map<string, string>,
    relatedFailures: ClassifiedFailure[],
  ): GeneratedFix | null {
    const missingPythonModule = /No module named ['"]?([^'"\s]+)['"]?/.exec(
      failure.errorMessage,
    );
    if (missingPythonModule) {
      const moduleName = missingPythonModule[1];
      const requirements = fileContents.get("requirements.txt");
      if (
        requirements &&
        !this.requirementsContainPackage(requirements, moduleName)
      ) {
        const correctedContent = requirements.trimEnd()
          ? `${requirements.trimEnd()}\n${moduleName}\n`
          : `${moduleName}\n`;
        logger.info(
          `Deterministic fix: adding missing Python dependency '${moduleName}' to requirements.txt`,
        );
        return {
          file: "requirements.txt",
          line: 1,
          originalError: failure.errorMessage,
          correctedContent,
        };
      }
    }

    const missingNodeModule = /Cannot find module ['"]?([^'"\s]+)['"]?/.exec(
      failure.errorMessage,
    );
    if (missingNodeModule) {
      const moduleName = missingNodeModule[1];
      const packageJson = fileContents.get("package.json");
      if (packageJson) {
        try {
          const parsed = JSON.parse(packageJson);
          parsed.dependencies = parsed.dependencies ?? {};
          parsed.devDependencies = parsed.devDependencies ?? {};

          if (
            !parsed.dependencies[moduleName] &&
            !parsed.devDependencies[moduleName]
          ) {
            parsed.dependencies[moduleName] = "latest";
            logger.info(
              `Deterministic fix: adding missing Node dependency '${moduleName}' to package.json`,
            );
            return {
              file: "package.json",
              line: 1,
              originalError: failure.errorMessage,
              correctedContent: `${JSON.stringify(parsed, null, 2)}\n`,
            };
          }
        } catch (err) {
          logger.warn(
            `Could not parse package.json for deterministic dependency fix: ${err instanceof Error ? err.message : err}`,
          );
        }
      }
    }

    const unknownCommand = /Unknown command '([^']+)'/.exec(failure.errorMessage);
    if (failure.file === "package.json" && unknownCommand) {
      const packageJson = fileContents.get("package.json");
      if (packageJson) {
        try {
          const parsed = JSON.parse(packageJson);
          const currentScript = parsed.scripts?.test;
          if (
            typeof currentScript === "string" &&
            parsed.devDependencies?.jest &&
            !currentScript.startsWith("jest")
          ) {
            parsed.scripts.test = currentScript.replace(
              unknownCommand[1],
              "jest",
            );
            logger.info(
              `Deterministic fix: correcting npm test script command '${unknownCommand[1]}' to 'jest'`,
            );
            return {
              file: "package.json",
              line: 1,
              originalError: failure.errorMessage,
              correctedContent: `${JSON.stringify(parsed, null, 2)}\n`,
            };
          }
        } catch (err) {
          logger.warn(
            `Could not parse package.json for deterministic script fix: ${err instanceof Error ? err.message : err}`,
          );
        }
      }
    }

    const content = fileContents.get(failure.file);
    if (
      content &&
      failure.bugType === "LINTING" &&
      failure.file.endsWith(".py")
    ) {
      const lintFix = this.tryGeneratePythonLintFix(
        failure.file,
        content,
        relatedFailures,
      );
      if (lintFix) {
        return lintFix;
      }
    }

    const numberToStringMismatch =
      /Type 'number' is not assignable to type 'string'/.test(
        failure.errorMessage,
      );
    if (content && numberToStringMismatch) {
      const lines = content.split(/\r?\n/);
      const lineIndex = failure.line - 1;
      const originalLine = lines[lineIndex];

      if (originalLine) {
        const returnMatch = originalLine.match(/^(\s*return\s+)(.+?)(;\s*(?:\/\/.*)?)$/);
        if (returnMatch) {
          lines[lineIndex] = `${returnMatch[1]}String(${returnMatch[2]})${returnMatch[3]}`;
          logger.info(
            `Deterministic fix: wrapping return value in String() for ${failure.file}:${failure.line}`,
          );
          return {
            file: failure.file,
            line: failure.line,
            originalError: failure.errorMessage,
            correctedContent: `${lines.join("\n")}\n`,
          };
        }
      }
    }

    return null;
  }

  private tryGeneratePythonLintFix(
    file: string,
    content: string,
    failures: ClassifiedFailure[],
  ): GeneratedFix | null {
    const lines = content.split(/\r?\n/);
    const removeLines = new Set<number>();
    let changed = false;

    for (const failure of failures) {
      const lineIndex = failure.line - 1;
      if (lineIndex < 0 || lineIndex >= lines.length) {
        continue;
      }

      if (/F401/.test(failure.errorMessage)) {
        removeLines.add(lineIndex);
        changed = true;
        continue;
      }

      let line = lines[lineIndex];
      const originalLine = line;

      if (/E231/.test(failure.errorMessage)) {
        line = line.replace(/,\s*/g, ", ");
      }

      if (/E225/.test(failure.errorMessage)) {
        line = line
          .replace(/\s*==\s*/g, " == ")
          .replace(/(?<![<>=!])\s*=\s*(?![=])/g, " = ")
          .replace(/([^\s])([+\-*/])([^\s])/g, "$1 $2 $3");
      }

      if (/W391/.test(failure.errorMessage)) {
        changed = true;
      }

      if (line !== originalLine) {
        lines[lineIndex] = line;
        changed = true;
      }
    }

    if (!changed) {
      return null;
    }

    const correctedLines = lines.filter((_, index) => !removeLines.has(index));
    while (
      correctedLines.length > 0 &&
      correctedLines[correctedLines.length - 1].trim() === ""
    ) {
      correctedLines.pop();
    }
    logger.info(`Deterministic fix: applying Python lint autofix to ${file}`);
    return {
      file,
      line: failures[0]?.line ?? 1,
      originalError: failures.map((item) => item.errorMessage).join("; "),
      correctedContent: `${correctedLines.join("\n")}\n`,
    };
  }

  private requirementsContainPackage(
    requirements: string,
    packageName: string,
  ): boolean {
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

  private async callApiWithRetry(
    userPrompt: string,
    originalContent: string,
  ): Promise<string> {
    for (let attempt = 1; attempt <= MAX_LLM_RETRIES; attempt++) {
      logger.info(
        `Model provider API call — attempt ${attempt}/${MAX_LLM_RETRIES}`,
      );
      try {
        const raw = await this.callApi(userPrompt);
        const cleaned = this.sanitizeResponse(raw);

        if (this.looksLikeExplanation(cleaned, originalContent)) {
          logger.warn(
            `Attempt ${attempt}: LLM returned explanation instead of file content — rejecting`,
          );
          if (attempt === MAX_LLM_RETRIES) {
            throw new Error(
              "LLM consistently returned explanation instead of file content after all retries",
            );
          }
          continue;
        }

        return cleaned;
      } catch (err) {
        if (attempt === MAX_LLM_RETRIES) {
          throw err;
        }

        const delayMs = this.getRetryDelayMs(err, attempt);
        if (delayMs > 0) {
          logger.warn(`Retrying model provider call in ${delayMs}ms`);
          await this.sleep(delayMs);
        }
      }
    }

    throw new Error("LLM retry loop exhausted");
  }

  private async callApi(userPrompt: string): Promise<string> {
    const payload = {
      model: "qwen/qwen3.5-397b-a17b",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.6,
      top_p: 0.95,
      top_k: 20,
      max_tokens: 16384,
      chat_template_kwargs: { enable_thinking: false },
      stream: false,
    };

    try {
      const response = await axios.post(this.config.apiUrl, payload, {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 60_000,
      });

      const content = response.data?.choices?.[0]?.message?.content;

      if (typeof content !== "string" || content.trim().length === 0) {
        throw new Error("API returned empty or invalid response");
      }

      logger.info(`API returned ${content.length} chars`);
      return content;
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status ?? "unknown";
        const body = err.response?.data ?? "";
        const code = err.code ?? "unknown";

        if (!err.response) {
          const reason =
            code === "ECONNABORTED"
              ? "request timed out before the provider returned a response"
              : err.message || "request failed before any HTTP response was received";
          logger.error(`NVIDIA API transport error (${code})`, reason);
          throw new ProviderApiError(
            `NVIDIA API transport error: ${reason}`,
          );
        }

        logger.error(`NVIDIA API error (${status})`, body);
        throw new ProviderApiError(`NVIDIA API error: HTTP ${status}`, Number(status));
      }
      throw err;
    }
  }

  private hasUsableProvider(): boolean {
    return Boolean(this.config.apiUrl && this.config.apiKey);
  }

  private getRetryDelayMs(error: unknown, attempt: number): number {
    if (error instanceof ProviderApiError) {
      if (error.status === 429) {
        return BASE_RETRY_DELAY_MS * attempt;
      }

      if (error.status && error.status >= 500) {
        return BASE_RETRY_DELAY_MS * attempt;
      }
    }

    return 0;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Strips markdown fences, triple backticks, and trims whitespace.
   * Ensures only raw file content remains.
   */
  private sanitizeResponse(content: string): string {
    let result = content.trim();

    // Strip wrapping ```lang ... ``` blocks
    const fencePattern = /^```[\w]*\n([\s\S]*?)```$/;
    const match = fencePattern.exec(result);
    if (match) {
      result = match[1];
    }

    // Strip any remaining leading/trailing fences
    result = result.replace(/^```[\w]*\n?/, "").replace(/\n?```$/, "");

    // Remove any stray triple backticks anywhere
    result = result.replace(/```/g, "");

    // Trim final result
    result = result.trim();

    // Ensure trailing newline (standard file ending)
    if (result.length > 0 && !result.endsWith("\n")) {
      result += "\n";
    }

    return result;
  }

  /**
   * Detects if the LLM returned explanation text instead of code.
   * Returns true if the response looks like commentary rather than file content.
   */
  private looksLikeExplanation(
    response: string,
    originalContent: string,
  ): boolean {
    const lines = response.split("\n");
    const totalLines = lines.length;
    const originalLines = originalContent.split("\n").length;

    // If response is way shorter than original, it's probably explanation
    if (totalLines < originalLines * 0.3 && totalLines < 5) {
      return true;
    }

    // Count lines that look like natural language explanation
    const explanationPatterns = [
      /^(Here|The|This|I |In |To |We |You |Note|Below|Above|Let me)/i,
      /^(The fix|The error|The issue|The problem|The solution)/i,
      /^(Step \d|First,|Second,|Finally,|However,|Therefore)/i,
      /^\d+\.\s+\w/, // numbered list
      /^[-*]\s+\w/, // bullet list
    ];

    let explanationLines = 0;
    for (const line of lines.slice(0, 10)) {
      const trimmed = line.trim();
      if (trimmed.length === 0) continue;
      if (explanationPatterns.some((p) => p.test(trimmed))) {
        explanationLines++;
      }
    }

    // If more than 30% of the first 10 lines look like explanation → reject
    if (explanationLines >= 3) {
      return true;
    }

    return false;
  }
}
