import { describe, expect, it, vi } from "vitest";
import {
  resolveApplePodcastEpisodeFromItunesLookup,
  resolvePodcastEpisodeFromItunesSearch,
  resolvePodcastFeedUrlFromItunesSearch,
} from "../packages/core/src/content/transcript/providers/podcast/itunes.js";

const fetchJson = (payload: unknown, status = 200) =>
  vi.fn(async () => Response.json(payload, { status })) as typeof fetch;

describe("iTunes podcast lookup coverage", () => {
  it("handles lookup failures, empty episodes, explicit matches, preview URLs, and fields", async () => {
    await expect(
      resolveApplePodcastEpisodeFromItunesLookup({
        fetchImpl: fetchJson({}, 500),
        showId: "1",
        episodeId: null,
      }),
    ).resolves.toBeNull();
    await expect(
      resolveApplePodcastEpisodeFromItunesLookup({
        fetchImpl: fetchJson({ results: [{ wrapperType: "track", kind: "podcast" }] }),
        showId: "1",
        episodeId: null,
      }),
    ).resolves.toBeNull();

    await expect(
      resolveApplePodcastEpisodeFromItunesLookup({
        fetchImpl: fetchJson({
          results: [
            { wrapperType: "track", kind: "podcast", feedUrl: " https://feed.test/rss " },
            {
              wrapperType: "podcastEpisode",
              trackId: 2,
              previewUrl: " https://cdn.test/preview.mp3 ",
              episodeFileExtension: ".mp3",
              trackTimeMillis: 12_000,
              trackName: " Episode two ",
              releaseDate: "bad",
            },
            {
              wrapperType: "podcastEpisode",
              trackId: 1,
              episodeUrl: "https://cdn.test/one.m4a",
              releaseDate: "2026-01-01",
            },
          ],
        }),
        showId: "show",
        episodeId: "2",
      }),
    ).resolves.toEqual({
      episodeUrl: "https://cdn.test/preview.mp3",
      feedUrl: "https://feed.test/rss",
      fileExtension: "mp3",
      durationSeconds: 12,
      episodeTitle: "Episode two",
    });
    await expect(
      resolveApplePodcastEpisodeFromItunesLookup({
        fetchImpl: fetchJson({
          results: [
            {
              wrapperType: "podcastEpisode",
              episodeUrl: "relative",
              releaseDate: "bad",
            },
          ],
        }),
        showId: "show",
        episodeId: "missing",
      }),
    ).resolves.toBeNull();
  });

  it("selects newest lookup episodes across valid and invalid dates", async () => {
    const result = await resolveApplePodcastEpisodeFromItunesLookup({
      fetchImpl: fetchJson({
        results: [
          {
            wrapperType: "podcastEpisode",
            episodeUrl: "https://cdn.test/bad.mp3",
            releaseDate: "",
          },
          {
            wrapperType: "podcastEpisode",
            episodeUrl: "https://cdn.test/old.mp3",
            releaseDate: "2025-01-01",
          },
          {
            wrapperType: "podcastEpisode",
            episodeUrl: "https://cdn.test/new.mp3",
            releaseDate: "2026-01-01",
            trackTimeMillis: Number.NaN,
          },
        ],
      }),
      showId: "show",
      episodeId: null,
    });
    expect(result).toMatchObject({
      episodeUrl: "https://cdn.test/new.mp3",
      durationSeconds: null,
      fileExtension: null,
      episodeTitle: null,
    });
  });

  it("resolves feed search exact, fallback, invalid, and empty results", async () => {
    await expect(
      resolvePodcastFeedUrlFromItunesSearch(fetchJson({}, 500), "Show"),
    ).resolves.toBeNull();
    await expect(
      resolvePodcastFeedUrlFromItunesSearch(fetchJson({ results: [] }), "Show"),
    ).resolves.toBeNull();
    await expect(
      resolvePodcastFeedUrlFromItunesSearch(
        fetchJson({
          results: [
            { collectionName: "Other", feedUrl: "https://other.test/rss" },
            { collectionName: " The Show! ", feedUrl: " https://show.test/rss " },
          ],
        }),
        "the show",
      ),
    ).resolves.toBe("https://show.test/rss");
    await expect(
      resolvePodcastFeedUrlFromItunesSearch(
        fetchJson({ results: [{ collectionName: "Other", feedUrl: "relative" }] }),
        "Show",
      ),
    ).resolves.toBeNull();
  });

  it("resolves episode search exact show, exact episode, fallback, and empty candidates", async () => {
    await expect(
      resolvePodcastEpisodeFromItunesSearch(fetchJson({}, 500), "Show", "Episode"),
    ).resolves.toBeNull();
    await expect(
      resolvePodcastEpisodeFromItunesSearch(fetchJson({ results: [] }), "Show", "Episode"),
    ).resolves.toBeNull();
    await expect(
      resolvePodcastEpisodeFromItunesSearch(
        fetchJson({ results: [{ trackName: "", episodeUrl: "" }] }),
        "Show",
        "Episode",
      ),
    ).resolves.toBeNull();

    const payload = {
      results: [
        {
          trackName: "Fallback",
          collectionName: "Other",
          episodeUrl: "https://cdn.test/fallback.mp3",
        },
        {
          trackName: "Episode",
          collectionName: "Other",
          episodeUrl: "https://cdn.test/episode.mp3",
          trackTimeMillis: Number.NaN,
        },
        {
          trackName: "Episode",
          collectionName: "Show",
          episodeUrl: "https://cdn.test/exact.mp3",
          trackTimeMillis: 9_000,
        },
      ],
    };
    await expect(
      resolvePodcastEpisodeFromItunesSearch(fetchJson(payload), "Show", "Episode"),
    ).resolves.toEqual({
      episodeUrl: "https://cdn.test/exact.mp3",
      durationSeconds: 9,
      episodeTitle: "Episode",
    });
    await expect(
      resolvePodcastEpisodeFromItunesSearch(fetchJson(payload), "Missing", "Episode"),
    ).resolves.toMatchObject({ episodeUrl: "https://cdn.test/episode.mp3", durationSeconds: null });
    await expect(
      resolvePodcastEpisodeFromItunesSearch(fetchJson(payload), "Missing", "Missing"),
    ).resolves.toMatchObject({ episodeUrl: "https://cdn.test/fallback.mp3" });
  });
});
