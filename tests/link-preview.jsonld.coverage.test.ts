import { describe, expect, it } from "vitest";
import { extractJsonLdContent } from "../packages/core/src/content/link-preview/content/jsonld.js";

function html(...scripts: string[]): string {
  return scripts.map((script) => `<script type="application/ld+json">${script}</script>`).join("");
}

describe("JSON-LD content coverage", () => {
  it("ignores empty, malformed, primitive, and content-free candidates", () => {
    expect(extractJsonLdContent("<main>No metadata</main>")).toBeNull();
    expect(
      extractJsonLdContent(
        html("", "{bad", "null", '"text"', JSON.stringify({ "@type": "Article" })),
      ),
    ).toBeNull();
  });

  it("collects arrays and graphs, normalizes fields, and prefers the longest description", () => {
    const result = extractJsonLdContent(
      html(
        JSON.stringify([
          {
            "@type": ["IgnoredNumber", 1],
            headline: " Short title ",
            summary: " Short description ",
          },
          {
            "@graph": [
              {
                "@type": [false, "PodcastEpisode"],
                title: "  Podcast   title ",
                description: "A much longer podcast description.",
              },
              { "@type": 42, name: "No usable type" },
            ],
          },
        ]),
      ),
    );

    expect(result).toEqual({
      title: "Podcast title",
      description: "A much longer podcast description.",
      type: "podcastepisode",
    });
  });

  it("accepts description-only candidates and lowercases string types", () => {
    expect(
      extractJsonLdContent(
        html(JSON.stringify({ "@type": "NEWSARTICLE", description: " Description only " })),
      ),
    ).toEqual({
      title: null,
      description: "Description only",
      type: "newsarticle",
    });
  });
});
