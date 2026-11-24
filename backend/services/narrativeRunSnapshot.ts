import { createHash } from "node:crypto";

export type PinnedSnapshot = {
  clusters: Array<Record<string, any>>;
  articles: Array<Record<string, any>>;
  missingArticleIds: string[];
};

function canonical(value: any): any {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

export function pinnedInputFingerprint(snapshot: PinnedSnapshot): string {
  return createHash("sha256").update(JSON.stringify(canonical(snapshot))).digest("hex");
}

export function pinnedInputIds(snapshot: PinnedSnapshot) {
  return {
    clusterIds: snapshot.clusters.map((item) => String(item._id)).sort(),
    articleIds: snapshot.articles.map((item) => String(item._id)).sort(),
  };
}

export function snapshotIntegrityIssues(snapshot: PinnedSnapshot, expected: { clusterIds: string[]; articleIds: string[]; fingerprint: string }) {
  const actual = pinnedInputIds(snapshot);
  const missingClusterIds = expected.clusterIds.filter((id) => !actual.clusterIds.includes(id));
  const missingArticleIds = expected.articleIds.filter((id) => !actual.articleIds.includes(id));
  const unexpectedClusterIds = actual.clusterIds.filter((id) => !expected.clusterIds.includes(id));
  const unexpectedArticleIds = actual.articleIds.filter((id) => !expected.articleIds.includes(id));
  const fingerprintMatches = pinnedInputFingerprint(snapshot) === expected.fingerprint;
  return { missingClusterIds, missingArticleIds, unexpectedClusterIds, unexpectedArticleIds, fingerprintMatches };
}

export function compareNarrativeVersions(source: Record<string, unknown>, executed: Record<string, unknown>) {
  return Object.fromEntries(Object.keys(executed).map((key) => [key, source[key] !== executed[key]]));
}
