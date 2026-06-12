import { describe, expect, it, vi } from "vitest";
import { createPanelViewRuntime } from "../apps/chrome-extension/src/entrypoints/sidepanel/panel-view-runtime.js";

const cache = {
  tabId: 1,
  url: "https://example.com",
  title: "Example",
  runId: null,
  slidesRunId: null,
  summaryMarkdown: null,
  summaryFromCache: null,
  slidesSummaryMarkdown: null,
  slidesSummaryComplete: null,
  slidesSummaryModel: null,
  lastMeta: { inputSummary: null, model: null, modelLabel: null },
  slides: null,
  transcriptTimedText: null,
};

describe("panel view runtime", () => {
  it("resets chat before ordinary summary resets and cache restores", () => {
    const resetChatState = vi.fn();
    const summaryView = {
      applyPanelCache: vi.fn(),
      resetSummaryView: vi.fn(),
    };
    const runtime = createPanelViewRuntime({ summaryView, resetChatState });

    runtime.resetPanelView({ clearRunId: false, stopSlides: false });
    runtime.applyPanelCache(cache);

    expect(resetChatState).toHaveBeenCalledTimes(2);
    expect(summaryView.resetSummaryView).toHaveBeenCalledWith({
      clearRunId: false,
      stopSlides: false,
    });
    expect(summaryView.applyPanelCache).toHaveBeenCalledWith(cache);
  });

  it("preserves chat when navigation policy requests it", () => {
    const resetChatState = vi.fn();
    const summaryView = {
      applyPanelCache: vi.fn(),
      resetSummaryView: vi.fn(),
    };
    const runtime = createPanelViewRuntime({ summaryView, resetChatState });

    runtime.resetPanelView({ preserveChat: true });
    runtime.applyPanelCache(cache, { preserveChat: true });

    expect(resetChatState).not.toHaveBeenCalled();
    expect(summaryView.resetSummaryView).toHaveBeenCalledWith({
      clearRunId: undefined,
      stopSlides: undefined,
    });
    expect(summaryView.applyPanelCache).toHaveBeenCalledWith(cache);
  });
});
