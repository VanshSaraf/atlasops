import { describe, expect, it } from "vitest";
import { validateRunRequest } from "../src/utils/request-validation";

describe("validateRunRequest", () => {
  it("defaults missing dryRun to true", () => {
    const result = validateRunRequest({ repoUrl: "/tmp/repo" });

    expect(result.ok).toBe(true);
    expect(result.data?.dryRun).toBe(true);
  });

  it("preserves explicit dryRun=true", () => {
    const result = validateRunRequest({ repoUrl: "/tmp/repo", dryRun: true });

    expect(result.ok).toBe(true);
    expect(result.data?.dryRun).toBe(true);
  });

  it("allows explicit dryRun=false", () => {
    const result = validateRunRequest({ repoUrl: "/tmp/repo", dryRun: false });

    expect(result.ok).toBe(true);
    expect(result.data?.dryRun).toBe(false);
  });

  it("rejects missing repoUrl with a clean validation error", () => {
    const result = validateRunRequest({ retryLimit: 2 });

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/repoUrl/i);
  });

  it("normalizes valid retryLimit values", () => {
    const result = validateRunRequest({
      repoUrl: "/tmp/repo",
      retryLimit: "3",
    });

    expect(result.ok).toBe(true);
    expect(result.data?.retryLimit).toBe(3);
  });

  it("rejects retryLimit values outside the supported range", () => {
    const result = validateRunRequest({
      repoUrl: "/tmp/repo",
      retryLimit: 21,
    });

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/retryLimit/i);
  });
});
