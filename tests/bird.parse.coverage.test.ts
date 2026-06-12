import { describe, expect, it } from "vitest";
import { parseBirdTweetPayload, parseXurlTweetPayload } from "../src/run/bird/parse.js";

describe("Bird/X payload parser coverage", () => {
  it("rejects invalid Bird payloads and unwraps arrays", () => {
    for (const raw of [null, {}, [], [{}], { text: 1 }]) {
      expect(() => parseBirdTweetPayload(raw)).toThrow("invalid payload");
    }
    expect(
      parseBirdTweetPayload([
        {
          id: "1",
          text: "tweet",
          author: { username: "user" },
          _raw: null,
        },
      ]),
    ).toEqual({
      id: "1",
      text: "tweet",
      author: { username: "user" },
      media: null,
      client: "bird",
    });
  });

  it("reports top-level X API errors including authorization guidance", () => {
    expect(() => parseXurlTweetPayload({ status: 401, detail: "Unauthorized" })).toThrow(
      "xurl auth status",
    );
    expect(() => parseXurlTweetPayload({ status: 500, title: "Server error" })).toThrow(
      "Server error (500)",
    );
    expect(() => parseXurlTweetPayload({ detail: "request broke" })).toThrow("request broke");
    expect(() => parseXurlTweetPayload({ status: 400 })).toThrow("request failed (400)");
    expect(() => parseXurlTweetPayload({ errors: [{ message: "nested error" }] })).toThrow(
      "nested error",
    );
    expect(() => parseXurlTweetPayload({ errors: [null] })).toThrow("invalid payload");
  });

  it("chooses longest tweet, note, or recursive article text", () => {
    expect(() => parseXurlTweetPayload({ data: {} })).toThrow("invalid payload");
    expect(
      parseXurlTweetPayload({
        data: {
          id: "1",
          author_id: "author",
          text: "short",
          note_tweet: { text: "a longer note tweet" },
          article: { title: "Article", text: "The body is the longest candidate here." },
          created_at: "2026-01-01",
        },
        includes: {
          users: [
            null,
            { id: "other", username: "wrong" },
            { id: "author", username: "handle", name: "Display" },
          ],
        },
      }),
    ).toMatchObject({
      id: "1",
      text: "Article\n\nThe body is the longest candidate here.",
      author: { username: "handle", name: "Display" },
      createdAt: "2026-01-01",
      client: "xurl",
    });

    expect(
      parseXurlTweetPayload({
        data: {
          article: {
            article_results: {
              result: { title: "Nested title", preview_text: "Nested preview" },
            },
          },
        },
      }),
    ).toMatchObject({ text: "Nested title\n\nNested preview", author: undefined });
    expect(parseXurlTweetPayload({ data: { article: { title: "Only title" } } })).toMatchObject({
      text: "Only title",
    });
    expect(parseXurlTweetPayload({ data: { article: { body: "Only body" } } })).toMatchObject({
      text: "Only body",
    });
    expect(
      parseXurlTweetPayload({
        data: { text: "text", author_id: "a" },
        includes: { users: [{ id: "a", name: "Name only" }] },
      }),
    ).toMatchObject({ author: { username: undefined, name: "Name only" } });
  });
});
