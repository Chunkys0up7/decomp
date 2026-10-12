// Builds the publish package (spec 6.6, DATA-13, DATA-17) and drives publish and export (spec 9.4.5).
import { useAriaAnnouncer } from "@salt-ds/core";
import { useCallback } from "react";
import { toAdapterError } from "../adapters/types";
import { buildArtifact, buildManifest, withHash, type Artifact, type PackageManifest } from "../domain/artifact";
import { decision } from "../store/selectors";
import type { AppState } from "../store/state";
import { useAppState, useDispatch } from "../store/StoreProvider";
import { useAdapters } from "./adapters";
import { copy } from "./copy";

export interface PublishPackage {
  manifest: PackageManifest;
  artifacts: Artifact[];
}

/** Approved cards as hashed artifacts, in seq order, plus the manifest. */
export async function buildPackage(state: AppState, publishedAt: string): Promise<PublishPackage> {
  const result = state.result;
  if (!result) throw new Error("No decomposition result to publish.");
  const approved = [...result.cards].sort((a, b) => a.seq - b.seq).filter((c) => decision(state, c) === "approved");
  const artifacts = await Promise.all(approved.map((c) => withHash(buildArtifact(c, result, "approved", state.review.resolutions))));
  return { artifacts, manifest: buildManifest(result, artifacts, state.review.decisions, state.review.resolutions, publishedAt) };
}

export function usePublish() {
  const state = useAppState();
  const dispatch = useDispatch();
  const { publish } = useAdapters();
  const { announce } = useAriaAnnouncer();

  const publishNow = useCallback(async () => {
    dispatch({ type: "PUBLISH_STARTED" });
    try {
      const pkg = await buildPackage(state, new Date().toISOString());
      const receipt = await publish.publish(pkg.manifest, pkg.artifacts, new AbortController().signal);
      dispatch({ type: "PUBLISH_SUCCEEDED", receipt });
      announce(copy.publish.success(receipt.counts.published, receipt.packageId, receipt.counts.rejected));
    } catch (e) {
      dispatch({ type: "PUBLISH_FAILED", error: toAdapterError(e).message });
    }
  }, [state, dispatch, publish, announce]);

  /** Export never changes publish state beyond recording that step 4 is complete (spec 9.4.5 item 5). */
  const exportNow = useCallback(async () => {
    const pkg = await buildPackage(state, state.publish.receipt?.publishedAt ?? new Date().toISOString());
    publish.exportFile(pkg.manifest, pkg.artifacts);
    dispatch({ type: "PUBLISH_EXPORTED" });
  }, [state, dispatch, publish]);

  return { publishNow, exportNow };
}
