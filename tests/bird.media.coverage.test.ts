import { describe, expect, it } from "vitest";
import { extractMediaFromBirdRaw, extractMediaFromXurlRaw } from "../src/run/bird/media.js";

describe("Bird media parser coverage", () => {
  it("rejects malformed and unsupported Bird payloads", () => {
    for (const raw of [null, [], "bad", {}, { legacy: { extended_entities: { media: [] } } }]) {
      expect(extractMediaFromBirdRaw(raw)).toBeNull();
    }
    expect(
      extractMediaFromBirdRaw({
        legacy: {
          extended_entities: {
            media: [
              null,
              { type: "photo" },
              { type: "video" },
              { type: "video", video_info: { variants: [null, {}, { url: "relative.mp4" }] } },
            ],
          },
        },
      }),
    ).toBeNull();
  });

  it("selects Bird variants, audio kind, card broadcasts, and entity videos", () => {
    expect(
      extractMediaFromBirdRaw({
        legacy: {
          extended_entities: {
            media: [
              {
                type: "animated_gif",
                video_info: {
                  variants: [
                    { url: "https://video.twimg.com/playlist.m3u8" },
                    {
                      url: "https://video.twimg.com/low.mp4",
                      content_type: "video/mp4",
                      bitrate: 100,
                    },
                    {
                      url: "https://video.twimg.com/high.mp4",
                      content_type: "video/mp4",
                      bitrate: 200,
                    },
                  ],
                },
              },
              {
                type: "audio",
                video_info: {
                  variants: [
                    {
                      url: "https://video.twimg.com/audio.mp4",
                      content_type: "audio/mp4",
                    },
                  ],
                },
              },
            ],
          },
        },
      }),
    ).toEqual({
      kind: "audio",
      urls: [
        "https://video.twimg.com/playlist.m3u8",
        "https://video.twimg.com/low.mp4",
        "https://video.twimg.com/high.mp4",
        "https://video.twimg.com/audio.mp4",
      ],
      preferredUrl: "https://video.twimg.com/high.mp4",
      source: "extended_entities",
    });

    expect(
      extractMediaFromBirdRaw({
        card: {
          legacy: {
            binding_values: [
              null,
              { key: "other", value: { string_value: "https://example.test/no" } },
              { key: "broadcast_url", value: null },
              { key: "broadcast_url", value: { string_value: "relative" } },
              {
                key: "broadcast_url",
                value: { string_value: "https://x.com/i/broadcasts/123" },
              },
            ],
          },
        },
      }),
    ).toMatchObject({
      source: "card",
      preferredUrl: "https://x.com/i/broadcasts/123",
    });

    expect(
      extractMediaFromBirdRaw({
        legacy: {
          entities: {
            urls: [
              null,
              { expanded_url: "https://example.test/page" },
              { expanded_url: "https://video.twimg.com/media.m3u8" },
            ],
          },
        },
      }),
    ).toMatchObject({
      source: "entities",
      urls: ["https://video.twimg.com/media.m3u8"],
    });
  });

  it("parses X API attachments, filtering keys and choosing variants or direct URLs", () => {
    for (const raw of [null, [], {}, { includes: { media: [] } }]) {
      expect(extractMediaFromXurlRaw(raw)).toBeNull();
    }

    expect(
      extractMediaFromXurlRaw({
        data: { attachments: { media_keys: [null, "wanted"] } },
        includes: {
          media: [
            null,
            { media_key: "other", type: "video", url: "https://video.twimg.com/other.mp4" },
            { media_key: "wanted", type: "photo", url: "https://pbs.twimg.com/photo.jpg" },
            {
              media_key: "wanted",
              type: "animated_gif",
              variants: [
                null,
                {},
                { url: "relative" },
                { url: "https://video.twimg.com/list.m3u8" },
                {
                  url: "https://video.twimg.com/low.mp4",
                  content_type: "video/mp4",
                  bit_rate: 100,
                },
                {
                  url: "https://video.twimg.com/high.mp4",
                  content_type: "video/mp4",
                  bit_rate: 200,
                },
              ],
            },
            {
              media_key: "wanted",
              type: "audio",
              variants: [],
              url: "https://video.twimg.com/direct.mp4",
            },
          ],
        },
      }),
    ).toEqual({
      kind: "audio",
      urls: [
        "https://video.twimg.com/list.m3u8",
        "https://video.twimg.com/low.mp4",
        "https://video.twimg.com/high.mp4",
        "https://video.twimg.com/direct.mp4",
      ],
      preferredUrl: "https://video.twimg.com/high.mp4",
      source: "xurl",
    });

    expect(
      extractMediaFromXurlRaw({
        includes: { media: [{ type: "video", url: "https://video.twimg.com/direct.mp4" }] },
      }),
    ).toMatchObject({ preferredUrl: "https://video.twimg.com/direct.mp4" });
  });
});
