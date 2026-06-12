import type { LinkPreviewProgressEvent } from "@steipete/summarize-core/content";
import { describe, expect, it } from "vitest";
import {
  applyTranscriptProgressEvent,
  createTranscriptProgressState,
  renderTranscriptLine,
  renderTranscriptSimple,
  resolveTranscriptOscPayload,
} from "../src/tty/progress/transcript-state.js";

const theme = {
  label: (value: string) => `<label>${value}</label>`,
  value: (value: string) => `<value>${value}</value>`,
  dim: (value: string) => `<dim>${value}</dim>`,
};

function apply(
  state: ReturnType<typeof createTranscriptProgressState>,
  event: LinkPreviewProgressEvent,
  nowMs = 1_000,
) {
  applyTranscriptProgressEvent(state, event, nowMs);
}

describe("transcript progress state coverage", () => {
  it("renders idle and download states with rates, totals, services, and themes", () => {
    const state = createTranscriptProgressState();
    expect(renderTranscriptSimple(state)).toBeNull();
    expect(renderTranscriptLine(state, { nowMs: 0 })).toBeNull();
    expect(resolveTranscriptOscPayload(state)).toBeNull();

    apply(state, {
      kind: "transcript-media-download-start",
      service: "youtube",
      mediaKind: "video",
      totalBytes: 2_000,
    });
    expect(renderTranscriptSimple(state)).toBe("Downloading video…");
    expect(renderTranscriptSimple(state, theme)).toBe(
      "<label>Downloading video</label><dim>…</dim>",
    );
    expect(renderTranscriptLine(state, { nowMs: 2_000 })).toContain(
      "Downloading video (youtube, 0 B/2.0 KB, 1.0s)",
    );
    expect(resolveTranscriptOscPayload(state)).toEqual({
      label: "Downloading video",
      percent: 0,
    });

    apply(
      state,
      {
        kind: "transcript-media-download-progress",
        service: "podcast",
        downloadedBytes: 1_000,
        totalBytes: 2_000,
      },
      1_500,
    );
    expect(state.startedAtMs).toBe(1_000);
    expect(renderTranscriptLine(state, { nowMs: 2_000, theme })).toContain(
      "<label>Downloading video</label>",
    );
    expect(renderTranscriptLine(state, { nowMs: 2_000, theme })).toContain("podcast");
    expect(resolveTranscriptOscPayload(state)?.percent).toBe(50);

    state.phase = "idle";
    state.startedAtMs = null;
    apply(
      state,
      {
        kind: "transcript-media-download-done",
        service: "generic",
        mediaKind: "audio",
        downloadedBytes: 3_000,
        totalBytes: 2_000,
      },
      2_000,
    );
    expect(state.startedAtMs).toBe(2_000);
    expect(renderTranscriptLine(state, { nowMs: 2_000 })).toBe("Downloading audio (2.9 KB, 0.0s)…");

    state.totalBytes = null;
    state.downloadedBytes = 0;
    expect(resolveTranscriptOscPayload(state)?.percent).toBeNull();
  });

  it("renders whisper progress, providers, models, durations, parts, and percentages", () => {
    const state = createTranscriptProgressState();
    apply(state, {
      kind: "transcript-whisper-start",
      service: "podcast",
      providerHint: "cpp->openai",
      modelId: "large-v3->fallback",
      totalDurationSeconds: 120,
      parts: 4,
    });
    expect(renderTranscriptSimple(state)).toBe("Transcribing…");
    expect(renderTranscriptLine(state, { nowMs: 2_000 })).toContain(
      "podcast, Whisper.cpp, large-v3, 2m, 1.0s",
    );
    expect(resolveTranscriptOscPayload(state)).toEqual({ label: "Transcribing", percent: 0 });

    apply(
      state,
      {
        kind: "transcript-whisper-progress",
        service: "youtube",
        processedDurationSeconds: 150,
        totalDurationSeconds: 100,
        partIndex: 3,
        parts: 4,
      },
      1_500,
    );
    expect(state.startedAtMs).toBe(1_000);
    expect(renderTranscriptLine(state, { nowMs: 2_000, theme })).toContain("<value>100%</value>");
    expect(renderTranscriptLine(state, { nowMs: 2_000 })).toContain("3/4");
    expect(resolveTranscriptOscPayload(state)?.percent).toBe(150);

    state.phase = "idle";
    state.startedAtMs = null;
    apply(
      state,
      {
        kind: "transcript-whisper-progress",
        service: "generic",
        processedDurationSeconds: null,
        totalDurationSeconds: null,
        partIndex: 2,
        parts: 4,
      },
      3_000,
    );
    expect(state.startedAtMs).toBe(3_000);
    expect(resolveTranscriptOscPayload(state)?.percent).toBe(50);

    for (const [providerHint, label] of [
      ["onnx", "ONNX (Parakeet/Canary)"],
      ["groq", "Whisper/Groq"],
      ["assemblyai", "AssemblyAI"],
      ["gemini", "Gemini"],
      ["openai", "Whisper/OpenAI"],
      ["fal", "Whisper/FAL"],
      ["unknown", "Whisper"],
    ] as const) {
      state.whisperProviderHint = providerHint;
      state.whisperModelId = null;
      state.whisperProcessedSeconds = null;
      state.whisperTotalSeconds = null;
      state.whisperPartIndex = null;
      state.whisperParts = null;
      expect(renderTranscriptLine(state, { nowMs: 3_000 })).toContain(label);
    }
    expect(resolveTranscriptOscPayload(state)?.percent).toBeNull();
  });
});
