import type { NavigationRuntime } from "./navigation-runtime";
import { panelUrlsMatch } from "./session-policy";

export type PanelSource = { url: string; title: string | null };

type ActiveTab = {
  id?: number;
  title?: string;
  url?: string;
};

type ActiveTabSyncOptions = {
  navigationRuntime: Pick<NavigationRuntime, "isRecentAgentNavigation" | "notePreserveChatForUrl">;
  getCurrentSource: () => PanelSource | null;
  setCurrentSource: (source: PanelSource | null) => void;
  resetForNavigation: (preserveChat: boolean) => void;
  setBaseTitle: (title: string) => void;
  queryActiveTab?: () => Promise<ActiveTab | null>;
};

function canSyncTabUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  if (url.startsWith("chrome://")) return false;
  if (url.startsWith("chrome-extension://")) return false;
  if (url.startsWith("moz-extension://")) return false;
  if (url.startsWith("edge://")) return false;
  if (url.startsWith("about:")) return false;
  return true;
}

export async function syncNavigationWithActiveTab(options: ActiveTabSyncOptions) {
  const currentSource = options.getCurrentSource();
  if (!currentSource) return;

  try {
    const tab = options.queryActiveTab
      ? await options.queryActiveTab()
      : ((await chrome.tabs.query({ active: true, currentWindow: true }))[0] ?? null);
    if (!tab?.url || !canSyncTabUrl(tab.url)) return;
    if (!panelUrlsMatch(tab.url, currentSource.url)) {
      const preserveChat = options.navigationRuntime.isRecentAgentNavigation(
        tab.id ?? null,
        tab.url,
      );
      if (preserveChat) options.navigationRuntime.notePreserveChatForUrl(tab.url);
      options.setCurrentSource(null);
      options.resetForNavigation(preserveChat);
      options.setBaseTitle(tab.title || tab.url || "Summarize");
      return;
    }
    if (tab.title && tab.title !== currentSource.title) {
      options.setCurrentSource({ ...currentSource, title: tab.title });
      options.setBaseTitle(tab.title);
    }
  } catch {
    // Ignore active-tab queries that fail during panel shutdown or navigation.
  }
}
