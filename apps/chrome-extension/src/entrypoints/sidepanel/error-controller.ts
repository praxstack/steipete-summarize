type ErrorControllerOptions = {
  panelEl: HTMLElement;
  panelMessageEl: HTMLElement;
  panelRetryBtn?: HTMLButtonElement | null;
  panelLogsBtn?: HTMLButtonElement | null;
  inlineEl: HTMLElement;
  inlineMessageEl: HTMLElement;
  inlineRetryBtn?: HTMLButtonElement | null;
  inlineLogsBtn?: HTMLButtonElement | null;
  inlineCloseBtn?: HTMLButtonElement | null;
  onPanelVisibilityChange?: () => void;
};

export type ErrorController = {
  bindActions: (actions: { onRetry: () => void; onOpenLogs: () => void }) => void;
  showPanelError: (message: string) => void;
  showInlineError: (message: string) => void;
  clearPanelError: () => void;
  clearInlineError: () => void;
  clearAll: () => void;
};

const stripInvisible = (message: string) => message.replace(/[\u200B-\u200D\uFEFF]/g, "");

const hasMeaningfulMessage = (message: string) =>
  stripInvisible(message).replace(/\s/g, "").length > 0;

const normalizeMessage = (message: string) => {
  const trimmed = stripInvisible(message).trim();
  return trimmed.length > 0 ? trimmed : "Something went wrong.";
};

export const createErrorController = (options: ErrorControllerOptions): ErrorController => {
  const {
    panelEl,
    panelMessageEl,
    panelRetryBtn,
    panelLogsBtn,
    inlineEl,
    inlineMessageEl,
    inlineRetryBtn,
    inlineLogsBtn,
    inlineCloseBtn,
    onPanelVisibilityChange,
  } = options;
  let actionsBound = false;

  const hideInline = () => {
    inlineMessageEl.textContent = "";
    inlineEl.classList.add("hidden");
    inlineEl.style.display = "none";
  };

  const hidePanel = () => {
    panelMessageEl.textContent = "";
    panelEl.classList.add("hidden");
    onPanelVisibilityChange?.();
  };

  const showPanel = (message: string) => {
    if (!hasMeaningfulMessage(message)) {
      hidePanel();
      return;
    }
    hideInline();
    panelMessageEl.textContent = normalizeMessage(message);
    panelEl.classList.remove("hidden");
    onPanelVisibilityChange?.();
  };

  const showInline = (message: string) => {
    if (!hasMeaningfulMessage(message)) {
      hideInline();
      return;
    }
    hidePanel();
    inlineMessageEl.textContent = normalizeMessage(message);
    inlineEl.classList.remove("hidden");
    inlineEl.style.display = "";
  };

  inlineCloseBtn?.addEventListener("click", () => hideInline());

  return {
    bindActions({ onRetry, onOpenLogs }) {
      if (actionsBound) return;
      actionsBound = true;
      panelRetryBtn?.addEventListener("click", onRetry);
      panelLogsBtn?.addEventListener("click", onOpenLogs);
      inlineRetryBtn?.addEventListener("click", onRetry);
      inlineLogsBtn?.addEventListener("click", onOpenLogs);
    },
    showPanelError: showPanel,
    showInlineError: showInline,
    clearPanelError: hidePanel,
    clearInlineError: hideInline,
    clearAll: () => {
      hidePanel();
      hideInline();
    },
  };
};
