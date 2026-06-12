import {
  deleteArtifact,
  getArtifactRecord,
  listArtifacts,
  parseArtifact,
  upsertArtifact,
} from "./artifacts-store";

export type ReplArtifactAction = {
  action: "list" | "get" | "upsert" | "delete";
  fileName?: string;
  content?: unknown;
  mimeType?: string;
  asBase64?: boolean;
};

export async function handleReplArtifactAction(payload: ReplArtifactAction): Promise<unknown> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("No active tab");
  const tabId = tab.id;

  if (payload.action === "list") {
    const records = await listArtifacts(tabId);
    return records.map(({ fileName, mimeType, size, updatedAt }) => ({
      fileName,
      mimeType,
      size,
      updatedAt,
    }));
  }

  if (payload.action === "get") {
    if (!payload.fileName) throw new Error("Missing fileName");
    const record = await getArtifactRecord(tabId, payload.fileName);
    if (!record) throw new Error(`Artifact not found: ${payload.fileName}`);
    if (payload.asBase64) return record;
    const isText =
      record.mimeType.startsWith("text/") ||
      record.mimeType === "application/json" ||
      record.fileName.endsWith(".json");
    return isText ? parseArtifact(record) : record;
  }

  if (payload.action === "upsert") {
    if (!payload.fileName) throw new Error("Missing fileName");
    const record = await upsertArtifact(tabId, {
      fileName: payload.fileName,
      content: payload.content,
      mimeType: payload.mimeType,
      contentBase64:
        typeof payload.content === "object" && payload.content && "contentBase64" in payload.content
          ? (payload.content as { contentBase64?: string }).contentBase64
          : undefined,
    });
    return {
      fileName: record.fileName,
      mimeType: record.mimeType,
      size: record.size,
      updatedAt: record.updatedAt,
    };
  }

  if (payload.action === "delete") {
    if (!payload.fileName) throw new Error("Missing fileName");
    return { ok: await deleteArtifact(tabId, payload.fileName) };
  }

  throw new Error(`Unknown artifact action: ${payload.action}`);
}
