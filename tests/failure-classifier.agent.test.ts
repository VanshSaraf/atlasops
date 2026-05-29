import { describe, expect, it } from "vitest";
import {
  BugType,
  FailureClassifierAgent,
} from "../src/agents/failure-classifier.agent";

describe("FailureClassifierAgent", () => {
  const classifier = new FailureClassifierAgent();

  it("classifies Python syntax errors", () => {
    const failures = classifier.classify([
      'E     File "/app/src/calculator.py", line 4',
      "E       def add(a, b)",
      "E                    ^",
      "E   SyntaxError: expected ':'",
    ].join("\n"));

    expect(failures[0]).toMatchObject({
      bugType: BugType.SYNTAX,
      file: "src/calculator.py",
      line: 4,
    });
    expect(failures[0]?.errorMessage).toContain("expected ':'");
  });

  it("classifies missing module failures", () => {
    const failures = classifier.classify([
      "tests/test_app.py:2: in <module>",
      "    import missing_package",
      "E   ModuleNotFoundError: No module named 'missing_package'",
    ].join("\n"));

    expect(failures[0]).toMatchObject({
      bugType: BugType.IMPORT,
      file: "tests/test_app.py",
      line: 2,
    });
    expect(failures[0]?.errorMessage).toContain("missing_package");
  });

  it("classifies TypeScript compile errors", () => {
    const failures = classifier.classify(
      "src/index.ts(10,5): error TS2322: Type 'number' is not assignable to type 'string'.",
    );

    expect(failures[0]).toMatchObject({
      bugType: BugType.TYPE_ERROR,
      file: "src/index.ts",
      line: 10,
    });
    expect(failures[0]?.errorMessage).toContain("TS2322");
  });

  it("uses the generic fallback for file-line errors", () => {
    const failures = classifier.classify(
      "src/main.py:12: error: unexpected build failure",
    );

    expect(failures[0]).toMatchObject({
      bugType: BugType.SYNTAX,
      file: "src/main.py",
      line: 12,
      errorMessage: "unexpected build failure",
    });
  });
});
