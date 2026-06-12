import type { PanelCachePayload } from "./panel-cache";

type SummaryResetOptions = {
  clearRunId?: boolean;
  stopSlides?: boolean;
};

type PanelResetOptions = SummaryResetOptions & {
  preserveChat?: boolean;
};

type SummaryViewPort = {
  applyPanelCache: (payload: PanelCachePayload) => void;
  resetSummaryView: (options?: SummaryResetOptions) => void;
};

export function createPanelViewRuntime({
  summaryView,
  resetChatState,
}: {
  summaryView: SummaryViewPort;
  resetChatState: () => void;
}) {
  const resetChatUnlessPreserved = (preserveChat: boolean | undefined) => {
    if (!preserveChat) resetChatState();
  };

  return {
    applyPanelCache(payload: PanelCachePayload, options?: { preserveChat?: boolean }) {
      resetChatUnlessPreserved(options?.preserveChat);
      summaryView.applyPanelCache(payload);
    },
    resetPanelView(options: PanelResetOptions = {}) {
      resetChatUnlessPreserved(options.preserveChat);
      summaryView.resetSummaryView({
        clearRunId: options.clearRunId,
        stopSlides: options.stopSlides,
      });
    },
  };
}
