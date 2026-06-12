import { describe, expect, it } from "vitest";
import { parseSpeakersConfig } from "../src/config/speakers.js";

const path = "/tmp/config.json";
const hash = "A".repeat(64);

function expectInvalid(speakers: unknown, fragment: string) {
  expect(() => parseSpeakersConfig({ speakers }, path)).toThrow(fragment);
}

describe("speaker config parser coverage", () => {
  it("handles absent, empty, and complete configurations", () => {
    expect(parseSpeakersConfig({}, path)).toBeUndefined();
    expect(parseSpeakersConfig({ speakers: {} }, path)).toEqual({});
    expect(
      parseSpeakersConfig(
        {
          speakers: {
            defaultProfile: "main",
            autoIdentify: false,
            model: " openai/gpt-5.5 ",
            minimumConfidence: 0,
            profiles: {
              main: {
                host: " Host ",
                knownSpeakers: [" Alice ", "alice", "Bob"],
                context: " Context ",
                model: " Model ",
                minimumConfidence: 1,
                autoIdentify: false,
              },
              empty: {},
            },
            sources: {
              episode: {
                profile: "main",
                anchors: [
                  { at: " 00:01 ", name: " Alice " },
                  { at: "00:02", name: "Bob" },
                ],
                transcriptHash: hash,
                mappings: { " SPEAKER_00 ": " Alice " },
              },
              empty: {},
            },
          },
        },
        path,
      ),
    ).toEqual({
      defaultProfile: "main",
      autoIdentify: false,
      model: "openai/gpt-5.5",
      minimumConfidence: 0,
      profiles: {
        main: {
          host: "Host",
          knownSpeakers: ["Alice", "Bob"],
          context: "Context",
          model: "Model",
          minimumConfidence: 1,
          autoIdentify: false,
        },
        empty: {},
      },
      sources: {
        episode: {
          profile: "main",
          anchors: [
            { at: "00:01", name: "Alice" },
            { at: "00:02", name: "Bob" },
          ],
          transcriptHash: hash.toLowerCase(),
          mappings: { SPEAKER_00: "Alice" },
        },
        empty: {},
      },
    });
  });

  it("rejects invalid top-level and profile fields", () => {
    expectInvalid("bad", "speakers");
    expectInvalid({ defaultProfile: "" }, "non-empty string");
    expectInvalid({ autoIdentify: "yes" }, "must be a boolean");
    expectInvalid({ minimumConfidence: -0.1 }, "number from 0 to 1");
    expectInvalid({ minimumConfidence: Number.NaN }, "number from 0 to 1");
    expectInvalid({ profiles: [] }, "profiles");
    expectInvalid({ profiles: { main: "bad" } }, "profiles.main");
    expectInvalid({ profiles: { " ": {} } }, "keys must not be empty");
    expectInvalid({ profiles: { main: { knownSpeakers: "Alice" } } }, "array of names");
    expectInvalid({ profiles: { main: { knownSpeakers: [""] } } }, "non-empty names");
    expectInvalid({ defaultProfile: "missing", profiles: { main: {} } }, "unknown profile");
  });

  it("rejects invalid source fields and cross references", () => {
    expectInvalid({ sources: [] }, "sources");
    expectInvalid({ sources: { episode: "bad" } }, "sources.episode");
    expectInvalid({ sources: { episode: { anchors: "bad" } } }, "anchors");
    expectInvalid({ sources: { episode: { anchors: ["bad"] } } }, "anchors[0]");
    expectInvalid({ sources: { episode: { anchors: [{ at: "", name: "Alice" }] } } }, "at");
    expectInvalid({ sources: { episode: { anchors: [{ at: "00:01", name: "" }] } } }, "name");
    expectInvalid({ sources: { episode: { transcriptHash: "bad" } } }, "SHA-256");
    expectInvalid({ sources: { episode: { mappings: [] } } }, "mappings");
    expectInvalid({ sources: { episode: { mappings: { "": "Alice" } } } }, "map non-empty labels");
    expectInvalid(
      { sources: { episode: { mappings: { SPEAKER_00: "" } } } },
      "map non-empty labels",
    );
    expectInvalid({ sources: { episode: { transcriptHash: hash } } }, "must be set together");
    expectInvalid(
      { sources: { episode: { mappings: { SPEAKER_00: "Alice" } } } },
      "must be set together",
    );
    expectInvalid(
      {
        profiles: { main: {} },
        sources: { episode: { profile: "missing" } },
      },
      "unknown profile",
    );
  });
});
