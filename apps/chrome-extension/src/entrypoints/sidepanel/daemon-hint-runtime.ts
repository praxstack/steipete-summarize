import { isGeminiNanoModel } from "../../lib/model-routing";
import type { Settings } from "../../lib/settings";
import type { UiState } from "./types";

export function shouldShowDaemonHint(state: UiState): boolean {
  const model = state.settings.model.trim().toLowerCase();
  const usesLocalDefault = model === "auto" || isGeminiNanoModel(model);
  return (
    !state.settings.daemonHintDismissed &&
    !(state.daemon.ok && state.daemon.authed) &&
    state.settings.summaryRuntime === "direct" &&
    state.settings.slideRuntime === "browser" &&
    !state.settings.providerConfigured &&
    usesLocalDefault
  );
}

export function createDaemonHintRuntime(options: {
  hintEl: HTMLElement;
  actionBtn: HTMLButtonElement;
  closeBtn: HTMLButtonElement;
  patchSettings: (patch: Pick<Settings, "daemonHintDismissed">) => Promise<unknown>;
  openOptions: () => void;
}) {
  let dismissedLocally = false;

  const update = (state: UiState) => {
    const visible = !dismissedLocally && shouldShowDaemonHint(state);
    options.hintEl.classList.toggle("hidden", !visible);
  };

  options.actionBtn.addEventListener("click", options.openOptions);
  options.closeBtn.addEventListener("click", () => {
    dismissedLocally = true;
    options.hintEl.classList.add("hidden");
    void options.patchSettings({ daemonHintDismissed: true }).catch(() => {});
  });

  return { update };
}
