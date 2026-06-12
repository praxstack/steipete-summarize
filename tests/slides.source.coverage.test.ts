import { describe, expect, it } from "vitest";
import type { ExtractedLinkContent } from "../src/content/index.js";
import { resolveSlideSource, resolveSlideSourceFromUrl } from "../src/slides/source.js";

function extracted(value: Partial<ExtractedLinkContent>): ExtractedLinkContent {
  return value as ExtractedLinkContent;
}

describe("slide source routing coverage", () => {
  it("prefers embedded, extracted, and requested YouTube identities", () => {
    expect(
      resolveSlideSource({
        url: "https://example.test/article",
        extracted: extracted({
          url: "https://example.test/article",
          video: { kind: "youtube", url: "https://youtu.be/abc123def45" },
        }),
      }),
    ).toMatchObject({ kind: "youtube", sourceId: "youtube-abc123def45" });
    expect(
      resolveSlideSource({
        url: "https://example.test/article",
        extracted: extracted({ url: "https://youtube.com/watch?v=abc123def45" }),
      }),
    ).toMatchObject({ kind: "youtube" });
    expect(
      resolveSlideSource({
        url: "https://youtube.com/watch?v=abc123def45",
        extracted: extracted({ url: "https://example.test/article" }),
      }),
    ).toMatchObject({ kind: "youtube" });
  });

  it("routes direct extracted and requested video URLs and rejects non-video URLs", () => {
    expect(
      resolveSlideSource({
        url: "https://example.test/page",
        extracted: extracted({
          url: "https://example.test/page",
          video: { kind: "direct", url: "https://cdn.example.test/video.mp4" },
        }),
      }),
    ).toMatchObject({ kind: "direct", url: "https://cdn.example.test/video.mp4" });
    expect(
      resolveSlideSource({
        url: "https://cdn.example.test/video.webm",
        extracted: extracted({ url: "" }),
      }),
    ).toMatchObject({ kind: "direct", url: "https://cdn.example.test/video.webm" });
    expect(
      resolveSlideSource({
        url: "https://example.test/page",
        extracted: extracted({ url: "https://example.test/page" }),
      }),
    ).toBeNull();
    expect(resolveSlideSourceFromUrl("https://youtube.com/")).toBeNull();
    expect(resolveSlideSourceFromUrl("not a video")).toBeNull();
  });
});
