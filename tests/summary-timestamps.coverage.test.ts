import { describe, expect, it } from "vitest";
import {
  buildSummaryTimestampLimitInstruction,
  ensureSummaryKeyMoments,
  resolveSummaryTimestampUpperBound,
  sanitizeSummaryKeyMoments,
  shouldSanitizeSummaryKeyMoments,
} from "../src/engine/summary-timestamps.js";

describe("summary timestamp coverage", () => {
  it("resolves absent, segment, timed-text, hour, and invalid duration bounds", () => {
    expect(
      resolveSummaryTimestampUpperBound({
        transcriptSegments: null,
        transcriptTimedText: null,
        mediaDurationSeconds: null,
      }),
    ).toBeNull();
    expect(
      buildSummaryTimestampLimitInstruction({
        transcriptSegments: null,
        transcriptTimedText: null,
        mediaDurationSeconds: null,
      }),
    ).toBeNull();
    expect(
      resolveSummaryTimestampUpperBound({
        transcriptSegments: [
          null,
          { startMs: -1_000, endMs: Number.NaN, text: "bad" },
          { startMs: 1_500, endMs: 5_900, text: "valid" },
        ],
        transcriptTimedText: "bad\n[01:02:03] final\n[1:99] invalid",
        mediaDurationSeconds: Number.NaN,
      }),
    ).toBe(3_723);
    expect(
      resolveSummaryTimestampUpperBound({
        transcriptSegments: [{ startMs: 5_000, text: "start only" }],
        transcriptTimedText: null,
        mediaDurationSeconds: 0,
      }),
    ).toBe(5);
  });

  it("decides when sanitization applies", () => {
    const extracted = {
      transcriptSegments: null,
      transcriptTimedText: "[0:01] text",
      mediaDurationSeconds: null,
    };
    expect(shouldSanitizeSummaryKeyMoments({ extracted, hasSlides: true })).toBe(false);
    expect(shouldSanitizeSummaryKeyMoments({ extracted, hasSlides: false })).toBe(true);
    expect(
      shouldSanitizeSummaryKeyMoments({
        extracted: {
          transcriptSegments: null,
          transcriptTimedText: null,
          mediaDurationSeconds: null,
        },
        hasSlides: false,
      }),
    ).toBe(false);
  });

  it("handles early returns, bare timestamps, clamping, headings, and multiple sections", () => {
    expect(sanitizeSummaryKeyMoments({ markdown: "", maxSeconds: 10 })).toBe("");
    expect(sanitizeSummaryKeyMoments({ markdown: "text", maxSeconds: null })).toBe("text");
    expect(
      sanitizeSummaryKeyMoments({
        markdown: [
          "Intro",
          "",
          "## Key moments:",
          "",
          "0:01 - valid",
          "+ 0:12: slight overshoot",
          "* [0:30] too late",
          "plain context",
          "",
          "## Next",
          "Body",
          "",
          "Key moments",
          "[0:02] second section",
        ].join("\n"),
        maxSeconds: 10,
      }),
    ).toBe(
      [
        "Intro",
        "",
        "## Key moments:",
        "0:01 - valid",
        "+ 0:10: slight overshoot",
        "plain context",
        "## Next",
        "Body",
        "",
        "Key moments",
        "[0:02] second section",
      ].join("\n"),
    );
  });

  it("adds sampled and truncated fallback moments while preserving existing sections", () => {
    const existing = "Summary\n\n### Key moments\n- [0:01] Existing";
    expect(
      ensureSummaryKeyMoments({
        markdown: existing,
        extracted: { transcriptTimedText: "[0:02] ignored" },
        maxSeconds: 10,
      }),
    ).toBe(existing);
    expect(
      ensureSummaryKeyMoments({
        markdown: "",
        extracted: { transcriptTimedText: "[0:01] ignored" },
        maxSeconds: 10,
      }),
    ).toBe("");
    expect(
      ensureSummaryKeyMoments({
        markdown: "Summary",
        extracted: { transcriptTimedText: "untimed\n[1:99] invalid\n[0:20] too late\n[0:01] !!!" },
        maxSeconds: 10,
      }),
    ).toBe("Summary");

    const longText = `*** ${"long transcript phrase ".repeat(12)}`;
    const result = ensureSummaryKeyMoments({
      markdown: " Summary ",
      extracted: {
        transcriptTimedText: [
          `[0:01] ${longText}`,
          "[0:02] second",
          "[0:03] third",
          "[0:04] fourth",
          "[0:05] fifth",
        ].join("\n"),
      },
      maxSeconds: 10,
    });
    expect(result).toContain("### Key moments");
    expect(result.match(/^- \[/gm)).toHaveLength(3);
    expect(result).toContain("- [0:01] long transcript phrase");
    expect(result).toContain("...");
    expect(result).toContain("- [0:03] third");
    expect(result).toContain("- [0:05] fifth");
  });
});
