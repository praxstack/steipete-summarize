import type { Message as PiMessage } from "@earendil-works/pi-ai";
import type { AgentMessage } from "@steipete/summarize-core/runtime";
import { describe, expectTypeOf, it } from "vitest";

describe("core agent message contract", () => {
  it("stays structurally compatible with the CLI AI runtime", () => {
    expectTypeOf<AgentMessage>().toMatchTypeOf<PiMessage>();
    expectTypeOf<PiMessage>().toMatchTypeOf<AgentMessage>();
  });
});
