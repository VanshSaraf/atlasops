import { describe, expect, it } from "vitest";
import { BugType, ClassifiedFailure } from "../src/agents/failure-classifier.agent";
import { FixGeneratorAgent } from "../src/agents/fix-generator.agent";

describe("FixGeneratorAgent deterministic fixes", () => {
  it("adds missing Python dependencies to requirements.txt without provider calls", async () => {
    const agent = new FixGeneratorAgent({ apiUrl: "", apiKey: "" });
    const failure: ClassifiedFailure = {
      bugType: BugType.IMPORT,
      file: "tests/test_app.py",
      line: 1,
      errorMessage: "ModuleNotFoundError: No module named 'requests'",
      fix: "Fix: add the import statement",
      raw: "",
    };

    const fixes = await agent.generateFixes(
      [failure],
      new Map([["requirements.txt", "pytest\n"]]),
    );

    expect(fixes).toHaveLength(1);
    expect(fixes[0]).toMatchObject({
      file: "requirements.txt",
      correctedContent: "pytest\nrequests\n",
    });
  });

  it("adds missing Node dependencies to package.json without provider calls", async () => {
    const agent = new FixGeneratorAgent({ apiUrl: "", apiKey: "" });
    const failure: ClassifiedFailure = {
      bugType: BugType.IMPORT,
      file: "src/index.ts",
      line: 1,
      errorMessage: "Cannot find module 'left-pad'",
      fix: "Fix: install or correct the import",
      raw: "",
    };

    const fixes = await agent.generateFixes(
      [failure],
      new Map([["package.json", JSON.stringify({ name: "sample" })]]),
    );

    expect(fixes).toHaveLength(1);
    const parsed = JSON.parse(fixes[0].correctedContent);
    expect(fixes[0].file).toBe("package.json");
    expect(parsed.dependencies["left-pad"]).toBe("latest");
  });
});
