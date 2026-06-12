import { describe, expect, it } from "vitest";
import {
  buildSlidePresentation,
  createSlidesPresentationStream,
  type SlidePresentationTextKind,
} from "../packages/core/src/slides/presentation.js";

const slides = [
  { index: 2, timestamp: 20 },
  { index: 1, timestamp: 0 },
  { index: 3, timestamp: 40 },
];

describe("slide presentation coverage", () => {
  it("builds ordered summary cards and transcript fallbacks", () => {
    const result = buildSlidePresentation({
      markdown: [
        "Intro paragraph.",
        "",
        "[slide:1]",
        "## First title",
        "First body.",
        "",
        "[slide:3]",
        "Title: Third title",
        "Third body.",
      ].join("\n"),
      slides,
      transcriptTimedText:
        "[00:00] first transcript\n[00:20] second transcript\n[00:40] third transcript",
      lengthArg: { kind: "preset", preset: "short" },
      coerce: false,
    });

    expect(result.cards.map((card) => card.index)).toEqual([1, 2, 3]);
    expect(result.cards[0]).toMatchObject({
      index: 1,
      title: "First title",
      body: "First body.",
      source: "summary",
    });
    expect(result.cards[1]).toMatchObject({
      index: 2,
      title: null,
      source: "transcript",
    });
    expect(result.cards[2]).toMatchObject({
      index: 3,
      title: "Third title",
      source: "summary",
    });
    expect(result.finalSummaryIndexes).toEqual(new Set([1, 3]));
    expect(result.summaries.get(1)).toBe("First body.");
    expect(result.titles.get(3)).toBe("Third title");
  });

  it("handles defaults, coercion controls, empty cards, and marker-only input", () => {
    const coerced = buildSlidePresentation({
      markdown: "Intro.\n\nOnly paragraph for the deck.",
      slides: [{ index: 1, timestamp: 0 }],
      transcriptTimedText: null,
      lengthArg: { kind: "chars", maxCharacters: 300 },
    });
    expect(coerced.markdown).toContain("[slide:1]");

    const parsedOnly = buildSlidePresentation({
      markdown: "[slide:4]\n## Four\nBody four.",
      slides: [],
      lengthArg: { kind: "preset", preset: "medium" },
      coerce: false,
      coerceReserveIntro: false,
      includeTranscriptFallback: false,
    });
    expect(parsedOnly.cards).toEqual([
      { index: 4, title: "Four", body: "Body four.", source: "summary" },
    ]);

    const empty = buildSlidePresentation({
      markdown: "[slide:1]\n",
      slides: [{ index: 1, timestamp: 0 }],
      transcriptTimedText: "",
      lengthArg: { kind: "preset", preset: "short" },
      coerce: false,
    });
    expect(empty.cards).toEqual([]);
  });

  it("streams intro text, tagged slides, labels, bare tags, and missing slides", async () => {
    const events: Array<
      | { type: "text"; value: string; kind: SlidePresentationTextKind }
      | { type: "slide"; index: number; title: string | null | undefined }
    > = [];
    const debug: string[] = [];
    const stream = createSlidesPresentationStream({
      getSlideIndexOrder: () => [1, 2, 3, 4, 5],
      getSlideMeta: (index) => ({ total: 5, timestamp: index * 10 }),
      onText: async (value, kind) => {
        events.push({ type: "text", value, kind });
      },
      onSlide: async (index, title) => {
        events.push({ type: "slide", index, title });
      },
      debugWrite: (value) => debug.push(value),
    });

    await stream.push("");
    await stream.push("Intro before a fragmented marker.\n[sl");
    await stream.push("ide:1]\n## First title\nFirst body.");
    await stream.push("\nSlide 2 of 5 - generated label\nSecond body.");
    await stream.push("\nslide: 3]\nHeadline: Third title\nThird body.");
    await stream.push("\n[slide marker 4]\n");
    await stream.push(`[slide:1]\n${"Long body content ".repeat(12)}`);
    await stream.finish();

    expect(events).toContainEqual({
      type: "text",
      value: "Intro before a fragmented marker.\n",
      kind: "intro",
    });
    expect(events).toContainEqual({ type: "slide", index: 1, title: "First title" });
    expect(events).toContainEqual({ type: "slide", index: 2, title: "Second body" });
    expect(events).toContainEqual({ type: "slide", index: 3, title: "Third title" });
    expect(events).toContainEqual({ type: "slide", index: 4, title: null });
    expect(events).toContainEqual({ type: "slide", index: 5, title: null });
    expect(events.filter((event) => event.type === "slide" && event.index === 1)).toHaveLength(1);
    expect(debug.some((line) => line.includes("slides marker"))).toBe(true);
  });

  it("flushes partial markers and title-only pending slides at finish", async () => {
    const text: string[] = [];
    const rendered: Array<[number, string | null | undefined]> = [];
    const stream = createSlidesPresentationStream({
      getSlideIndexOrder: () => [7, 8],
      getSlideMeta: null,
      onText: (value) => {
        text.push(value);
      },
      onSlide: (index, title) => {
        rendered.push([index, title]);
      },
    });

    await stream.push("Visible [");
    await stream.push("not-a-slide]");
    await stream.push("\n[slide:7]");
    await stream.push("\n## Deferred title");
    await stream.finish();

    expect(text.join("")).toBe("Visible \n");
    expect(rendered).toContainEqual([7, "Deferred title"]);
    expect(rendered).toContainEqual([8, null]);
  });

  it("handles malformed fallback tags and sanitizes stray slide markers", async () => {
    const text: string[] = [];
    const rendered: number[] = [];
    const stream = createSlidesPresentationStream({
      getSlideIndexOrder: () => [],
      onText: (value) => text.push(value),
      onSlide: (index) => rendered.push(index),
    });

    await stream.push("before [slide nonsense] after");
    await stream.push("\n[weird slide marker 9 suffix]\nBody");
    await stream.finish();

    expect(text.join("")).not.toContain("slide nonsense");
    expect(rendered).toContain(9);
  });
});
