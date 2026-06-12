import { panelUrlsMatch } from "./session-policy";

export type NavigationRuntime = {
  markAgentNavigationIntent: (url: string | null | undefined) => void;
  markAgentNavigationResult: (details: unknown) => void;
  getLastAgentNavigationUrl: () => string | null;
  isRecentAgentNavigation: (tabId: number | null, url: string | null) => boolean;
  notePreserveChatForUrl: (url: string | null) => void;
  shouldPreserveChatForRun: (url: string) => boolean;
};

type NavigationRuntimeOptions = {
  ttlMs?: number;
};

type AgentNavigation = { url: string; tabId: number | null; at: number };

export function createNavigationRuntime(options: NavigationRuntimeOptions = {}): NavigationRuntime {
  const { ttlMs = 20_000 } = options;
  let lastAgentNavigation: AgentNavigation | null = null;
  let pendingPreserveChatForUrl: { url: string; at: number } | null = null;

  const isRecentAgentNavigation = (tabId: number | null, url: string | null) => {
    if (!lastAgentNavigation) return false;
    if (Date.now() - lastAgentNavigation.at > ttlMs) {
      lastAgentNavigation = null;
      return false;
    }
    if (tabId != null && lastAgentNavigation.tabId != null && tabId === lastAgentNavigation.tabId) {
      return true;
    }
    if (url && lastAgentNavigation.url && panelUrlsMatch(url, lastAgentNavigation.url)) {
      return true;
    }
    return false;
  };

  const notePreserveChatForUrl = (url: string | null) => {
    if (!url) return;
    pendingPreserveChatForUrl = { url, at: Date.now() };
  };

  const shouldPreserveChatForRun = (url: string) => {
    const pending = pendingPreserveChatForUrl;
    if (pending && Date.now() - pending.at < ttlMs && panelUrlsMatch(url, pending.url)) {
      pendingPreserveChatForUrl = null;
      return true;
    }
    return isRecentAgentNavigation(null, url);
  };

  return {
    markAgentNavigationIntent(url) {
      const trimmed = typeof url === "string" ? url.trim() : "";
      if (!trimmed) return;
      lastAgentNavigation = { url: trimmed, tabId: null, at: Date.now() };
    },
    markAgentNavigationResult(details) {
      if (!details || typeof details !== "object") return;
      const obj = details as { finalUrl?: unknown; tabId?: unknown };
      const finalUrl = typeof obj.finalUrl === "string" ? obj.finalUrl.trim() : "";
      const tabId = typeof obj.tabId === "number" ? obj.tabId : null;
      if (!finalUrl && tabId == null) return;
      lastAgentNavigation = {
        url: finalUrl || lastAgentNavigation?.url || "",
        tabId,
        at: Date.now(),
      };
    },
    getLastAgentNavigationUrl() {
      return lastAgentNavigation?.url ?? null;
    },
    isRecentAgentNavigation,
    notePreserveChatForUrl,
    shouldPreserveChatForRun,
  };
}
