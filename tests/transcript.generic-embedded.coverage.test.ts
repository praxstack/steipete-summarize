import { describe, expect, it, vi } from "vitest";
import {
  detectEmbeddedMedia,
  fetchCaptionTrack,
} from "../packages/core/src/content/transcript/providers/generic-embedded.js";

describe("generic embedded transcript coverage", () => {
  it("detects video, audio, OpenGraph, track-only, and empty pages", () => {
    expect(detectEmbeddedMedia("<html></html>", "https://example.test/page")).toBeNull();
    expect(
      detectEmbeddedMedia(
        [
          '<video src="/watch">',
          '<track kind="captions" src="/fr.vtt" srclang="fr">',
          '<track kind="subtitles" src="/en.vtt" lang="EN-us" type="text/vtt">',
          "</video>",
          '<meta property="og:video" content="https://cdn.example.test/video.mp4">',
        ].join(""),
        "https://example.test/page",
      ),
    ).toEqual({
      kind: "video",
      mediaUrl: "https://cdn.example.test/video.mp4",
      track: {
        url: "https://example.test/en.vtt",
        type: "text/vtt",
        language: "en-us",
      },
    });
    expect(
      detectEmbeddedMedia('<audio><source src="/audio.mp3"></audio>', "https://example.test/page"),
    ).toMatchObject({ kind: "audio", mediaUrl: "https://example.test/audio.mp3" });
    expect(
      detectEmbeddedMedia(
        '<meta name="og:audio:url" content="/stream"><audio></audio>',
        "https://example.test/page",
      ),
    ).toEqual({ kind: "audio", mediaUrl: "https://example.test/stream", track: null });
    expect(
      detectEmbeddedMedia(
        '<track kind="captions" src="/captions.vtt"><video></video>',
        "https://example.test/page",
      ),
    ).toMatchObject({ kind: "video", mediaUrl: null });
    expect(detectEmbeddedMedia("<audio></audio>", "https://example.test/page")).toEqual({
      kind: "audio",
      mediaUrl: null,
      track: null,
    });
    expect(
      detectEmbeddedMedia(
        '<video><track kind="captions" src=" "><track kind="captions" src="::bad"></video>',
        "not a url",
      ),
    ).toEqual({ kind: "video", mediaUrl: null, track: null });
  });

  it("fetches JSON, VTT, and plain caption tracks with notes and segments", async () => {
    const notes: string[] = [];
    const jsonTrack = {
      url: "https://example.test/captions.json",
      type: "application/json",
      language: "en",
    };
    const jsonFetch = vi.fn(async () =>
      Response.json([
        { start: 0, duration: 1, text: "Hello" },
        { start: 1, duration: 1, text: "world" },
      ]),
    ) as typeof fetch;
    const json = await fetchCaptionTrack(jsonFetch, jsonTrack, notes, true);
    expect(json?.text).toContain("Hello");
    expect(json?.segments).toHaveLength(2);

    const vtt = await fetchCaptionTrack(
      vi.fn(
        async () =>
          new Response("WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nCaption text", {
            headers: { "content-type": "text/vtt" },
          }),
      ) as typeof fetch,
      { url: "https://example.test/captions", type: null, language: null },
      notes,
      false,
    );
    expect(vtt).toEqual({ text: "Caption text", segments: null });

    await expect(
      fetchCaptionTrack(
        vi.fn(async () => new Response(" plain captions ")) as typeof fetch,
        { url: "https://example.test/captions.txt", type: null, language: null },
        notes,
        true,
      ),
    ).resolves.toEqual({ text: "plain captions", segments: null });
    await expect(
      fetchCaptionTrack(
        vi.fn(async () => new Response(" ")) as typeof fetch,
        { url: "https://example.test/empty.txt", type: null, language: null },
        notes,
        true,
      ),
    ).resolves.toBeNull();
  });

  it("records HTTP, JSON, empty-VTT, Error, and non-Error failures", async () => {
    const notes: string[] = [];
    await expect(
      fetchCaptionTrack(
        vi.fn(async () => new Response("bad", { status: 404 })) as typeof fetch,
        { url: "https://example.test/missing", type: null, language: null },
        notes,
        true,
      ),
    ).resolves.toBeNull();
    await expect(
      fetchCaptionTrack(
        vi.fn(
          async () => new Response("{bad", { headers: { "content-type": "application/json" } }),
        ) as typeof fetch,
        { url: "https://example.test/bad", type: null, language: null },
        notes,
        true,
      ),
    ).resolves.toBeNull();
    await expect(
      fetchCaptionTrack(
        vi.fn(async () => new Response("WEBVTT\n\n")) as typeof fetch,
        { url: "https://example.test/empty.vtt", type: "text/vtt", language: null },
        notes,
        true,
      ),
    ).resolves.toBeNull();
    await expect(
      fetchCaptionTrack(
        vi.fn(async () => {
          throw new Error("network");
        }) as typeof fetch,
        { url: "https://example.test/error", type: null, language: null },
        notes,
        true,
      ),
    ).resolves.toBeNull();
    await expect(
      fetchCaptionTrack(
        vi.fn(async () => {
          throw "string failure";
        }) as typeof fetch,
        { url: "https://example.test/error", type: null, language: null },
        notes,
        true,
      ),
    ).resolves.toBeNull();
    expect(notes).toEqual([
      "Embedded captions fetch failed (404)",
      "Embedded captions JSON parse failed",
      "Embedded captions fetch failed: network",
      "Embedded captions fetch failed: string failure",
    ]);
  });
});
