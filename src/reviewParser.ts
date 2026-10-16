export interface ReviewFinding {
  categories: readonly string[];
  markerStartLine: number;
  contentStartLine: number;
  contentEndLine: number;
  markerEndLine: number;
}

export interface ReviewDiagnostic {
  line: number;
  message: string;
}

export interface ParseResult {
  findings: readonly ReviewFinding[];
  diagnostics: readonly ReviewDiagnostic[];
}

const startMarker = /^\s*<!--\s*REVIEW:START\s+([A-Z][A-Z-]*(?:\s+[A-Z][A-Z-]*)*)\s*-->\s*$/;
const endMarker = /^\s*<!--\s*REVIEW:END\s*-->\s*$/;

interface OpenReview {
  categories: readonly string[];
  markerStartLine: number;
}

export function parseReviewMarkers(lines: readonly string[]): ParseResult {
  const findings: ReviewFinding[] = [];
  const diagnostics: ReviewDiagnostic[] = [];
  let openReview: OpenReview | undefined;

  for (let line = 0; line < lines.length; line += 1) {
    const startMatch = lines[line].match(startMarker);

    if (startMatch) {
      if (openReview) {
        diagnostics.push({
          line: openReview.markerStartLine,
          message: "REVIEW:START has no matching REVIEW:END."
        });
      }

      openReview = {
        categories: startMatch[1].split(" "),
        markerStartLine: line
      };

      if (line + 1 >= lines.length || lines[line + 1].trim() === "") {
        diagnostics.push({
          line,
          message: "REVIEW:START must be immediately followed by flagged content."
        });
      }
      continue;
    }

    if (!endMarker.test(lines[line])) {
      continue;
    }

    if (!openReview) {
      diagnostics.push({
        line,
        message: "REVIEW:END has no matching REVIEW:START."
      });
      continue;
    }

    if (line === openReview.markerStartLine + 1 || lines[line - 1].trim() === "") {
      diagnostics.push({
        line,
        message: "REVIEW:END must immediately follow flagged content."
      });
    }

    if (line > openReview.markerStartLine + 1) {
      findings.push({
        categories: openReview.categories,
        markerStartLine: openReview.markerStartLine,
        contentStartLine: openReview.markerStartLine + 1,
        contentEndLine: line - 1,
        markerEndLine: line
      });
    }
    openReview = undefined;
  }

  if (openReview) {
    diagnostics.push({
      line: openReview.markerStartLine,
      message: "REVIEW:START has no matching REVIEW:END."
    });
  }

  return { findings, diagnostics };
}
