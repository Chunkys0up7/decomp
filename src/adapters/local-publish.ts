// Local publish (build spec 8.2): validates artifacts against the schema, then "publishes" by
// returning a receipt. exportFile downloads one JSON file with the manifest and artifacts.
import Ajv2020 from "ajv/dist/2020";
import schema from "../domain/schema/policy-card.schema.json";
import type { Artifact, PackageManifest } from "../domain/artifact";
import { delay, type PublishAdapter } from "./types";

const ajv = new Ajv2020({ allErrors: true });
export const validateArtifact = ajv.compile(schema);

/** DATA-16 at publish time. Returns human-readable errors; empty means valid. */
export function artifactErrors(artifacts: readonly unknown[]): string[] {
  return artifacts.flatMap((a, n) =>
    validateArtifact(a) ? [] : (validateArtifact.errors ?? []).map((e) => `artifact ${n + 1}${e.instancePath}: ${e.message}`),
  );
}

export const exportFileName = (policyId: string, version: string) => `${policyId}@${version}.policy-cards.json`;

export function createLocalPublish({ delayMs = 300 }: { delayMs?: number } = {}): PublishAdapter {
  return {
    async publish(manifest, artifacts, signal) {
      const errors = artifactErrors(artifacts);
      if (errors.length) {
        console.error("Artifact validation failed", errors);
        throw { code: "invalid_artifact", message: "Some artifacts failed validation and were not published.", retryable: false };
      }
      await delay(delayMs, signal);
      const m = manifest as PackageManifest;
      return {
        packageId: `${m.policy.id}@${m.policy.version}`,
        publishedAt: m.published_at,
        counts: { published: (artifacts as Artifact[]).length, rejected: m.rejected.length },
      };
    },
    exportFile(manifest, artifacts) {
      const m = manifest as PackageManifest;
      const blob = new Blob([JSON.stringify({ manifest, artifacts }, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = exportFileName(m.policy.id, m.policy.version);
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
  };
}
