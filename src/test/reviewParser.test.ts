import assert from "node:assert/strict";
import test from "node:test";
import { parseReviewMarkers } from "../reviewParser";

test("parses one finding with bundled categories", () => {
  const result = parseReviewMarkers([
    "<!-- REVIEW:START FILLER VAGUE -->",
    "This is very unclear.",
    "<!-- REVIEW:END -->"
  ]);

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.findings, [{
    categories: ["FILLER", "VAGUE"],
    markerStartLine: 0,
    contentStartLine: 1,
    contentEndLine: 1,
    markerEndLine: 2
  }]);
});

test("preserves a paragraph and its list as one flanked range", () => {
  const result = parseReviewMarkers([
    "<!-- REVIEW:START MISSING-CONTEXT -->",
    "The flags are:",
    "",
    "- `--threads`",
    "- `--memory`",
    "<!-- REVIEW:END -->"
  ]);

  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].contentStartLine, 1);
  assert.equal(result.findings[0].contentEndLine, 4);
  assert.deepEqual(result.diagnostics, []);
});

test("reports unmatched and non-flush markers without discarding the finding", () => {
  const result = parseReviewMarkers([
    "<!-- REVIEW:START FILLER -->",
    "",
    "A paragraph.",
    "",
    "<!-- REVIEW:END -->",
    "<!-- REVIEW:END -->",
    "<!-- REVIEW:START PASSIVE -->"
  ]);

  assert.equal(result.findings.length, 1);
  assert.deepEqual(
    result.diagnostics.map((diagnostic) => diagnostic.message),
    [
      "REVIEW:START must be immediately followed by flagged content.",
      "REVIEW:END must immediately follow flagged content.",
      "REVIEW:END has no matching REVIEW:START.",
      "REVIEW:START must be immediately followed by flagged content.",
      "REVIEW:START has no matching REVIEW:END."
    ]
  );
});

test("ignores marker-like comments with invalid category syntax", () => {
  const result = parseReviewMarkers([
    "<!-- REVIEW:START filler -->",
    "A paragraph.",
    "<!-- REVIEW:END -->"
  ]);

  assert.deepEqual(result.findings, []);
  assert.deepEqual(result.diagnostics, [{
    line: 2,
    message: "REVIEW:END has no matching REVIEW:START."
  }]);
});

test("does not create a finding for an empty marker pair", () => {
  const result = parseReviewMarkers([
    "<!-- REVIEW:START FILLER -->",
    "<!-- REVIEW:END -->"
  ]);

  assert.deepEqual(result.findings, []);
  assert.deepEqual(result.diagnostics, [{
    line: 1,
    message: "REVIEW:END must immediately follow flagged content."
  }]);
});
