import { describe, expect, it } from "vitest";
import {
  buildPromptLengthInstruction,
  createEmptyRunOverrides,
  resolveCliRunSettings,
  resolveOutputLanguageSetting,
  resolveRunOverrides,
  resolveSummaryLength,
} from "../src/run/run-settings.js";

describe("run settings coverage", () => {
  it("resolves length, prompt guidance, language, and CLI settings", () => {
    expect(createEmptyRunOverrides()).toMatchObject({
      firecrawlMode: null,
      autoCliOrder: null,
    });
    expect(resolveSummaryLength(undefined)).toMatchObject({
      lengthArg: { kind: "preset", preset: "long" },
      summaryLength: "long",
    });
    expect(resolveSummaryLength(" 1200 ")).toEqual({
      lengthArg: { kind: "chars", maxCharacters: 1200 },
      summaryLength: { maxCharacters: 1200 },
    });
    expect(buildPromptLengthInstruction({ kind: "chars", maxCharacters: 1234 })).toContain("1,234");
    expect(buildPromptLengthInstruction({ kind: "preset", preset: "short" })).toBeTruthy();
    expect(resolveOutputLanguageSetting({ raw: " ", fallback: "auto" })).toBe("auto");
    expect(resolveOutputLanguageSetting({ raw: " French ", fallback: "auto" })).toEqual({
      kind: "fixed",
      tag: "fr",
      label: "French",
    });

    expect(
      resolveCliRunSettings({
        length: "short",
        firecrawl: "auto",
        markdownMode: undefined,
        markdown: "llm",
        format: "markdown",
        preprocess: "auto",
        youtube: "auto",
        timeout: "30s",
        retries: "2",
        maxOutputTokens: "1k",
      }),
    ).toMatchObject({
      lengthArg: { kind: "preset", preset: "short" },
      markdownMode: "llm",
      timeoutMs: 30_000,
      retries: 2,
      maxOutputTokensArg: 1_000,
    });
    expect(
      resolveCliRunSettings({
        length: "short",
        firecrawl: "off",
        format: "text",
        preprocess: "off",
        youtube: "no-auto",
        timeout: "1s",
        retries: "0",
      }).markdownMode,
    ).toBe("off");
  });

  it("covers numeric and string override failures in permissive and strict modes", () => {
    for (const input of [
      { timeout: 0 },
      { timeout: Number.NaN },
      { timeout: "bad" },
      { retries: 1.5 },
      { retries: -1 },
      { retries: "bad" },
      { maxOutputTokens: 0 },
      { maxOutputTokens: Number.NaN },
      { maxOutputTokens: "bad" },
      { transcriber: "bad" },
      { forceSummary: "bad" },
      { timestamps: "bad" },
    ]) {
      expect(resolveRunOverrides(input)).toMatchObject({
        timeoutMs: null,
        retries: null,
        maxOutputTokensArg: null,
      });
      expect(() => resolveRunOverrides(input, { strict: true })).toThrow();
    }
  });

  it("parses every optional mode and legacy CLI alias", () => {
    expect(
      resolveRunOverrides({
        firecrawl: "always",
        markdownMode: "readability",
        preprocess: "auto",
        youtube: "auto",
        videoMode: "transcript",
        embeddedVideo: "prefer",
        timestamps: true,
        diarize: "auto",
        forceSummary: false,
        timeout: 1_500.9,
        retries: 0,
        maxOutputTokens: 256,
        transcriber: "Canary",
        magicCliAuto: "on",
        magicCliOrder: ["pi", "codex"],
        autoCliRememberLastSuccess: false,
        magicCliRememberLastSuccess: false,
      }),
    ).toEqual({
      firecrawlMode: "always",
      markdownMode: "readability",
      preprocessMode: "auto",
      youtubeMode: "auto",
      videoMode: "transcript",
      embeddedVideoMode: "prefer",
      transcriptTimestamps: true,
      transcriptDiarization: "auto",
      forceSummary: false,
      timeoutMs: 1_500,
      retries: 0,
      maxOutputTokensArg: 256,
      transcriber: "canary",
      autoCliFallbackEnabled: true,
      autoCliOrder: ["pi", "codex"],
    });
    expect(
      resolveRunOverrides({ timeout: null, retries: null, maxOutputTokens: null }),
    ).toMatchObject({
      timeoutMs: null,
      retries: null,
      maxOutputTokensArg: null,
    });
  });
});
