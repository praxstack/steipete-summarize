import type { AssetInputContext } from "./flows/asset/input.js";
import { summarizeAsset as summarizeAssetFlow } from "./flows/asset/summary.js";
import type { AssetSummaryContext, SummarizeAssetArgs } from "./flows/asset/types.js";

type SummarizeMediaFile = typeof import("./flows/asset/media.js").summarizeMediaFile;

export function createRunnerAssetInputContext({
  summarizeMediaFileImpl,
  assetSummaryContext,
  progressEnabled,
  trackedFetch,
  setClearProgressBeforeStdout,
  clearProgressIfCurrent,
}: {
  summarizeMediaFileImpl: SummarizeMediaFile;
  assetSummaryContext: AssetSummaryContext;
  progressEnabled: boolean;
  trackedFetch: typeof fetch;
  setClearProgressBeforeStdout: AssetInputContext["setClearProgressBeforeStdout"];
  clearProgressIfCurrent: AssetInputContext["clearProgressIfCurrent"];
}): AssetInputContext {
  const summarizeAsset = (args: SummarizeAssetArgs) =>
    summarizeAssetFlow(assetSummaryContext, args);
  const summarizeMediaFile = (args: Parameters<SummarizeMediaFile>[1]) =>
    summarizeMediaFileImpl(assetSummaryContext, args);
  return {
    env: assetSummaryContext.env,
    envForRun: assetSummaryContext.envForRun,
    stderr: assetSummaryContext.stderr,
    progressEnabled,
    timeoutMs: assetSummaryContext.timeoutMs,
    trackedFetch,
    summarizeAsset,
    summarizeMediaFile,
    setClearProgressBeforeStdout,
    clearProgressIfCurrent,
  };
}
