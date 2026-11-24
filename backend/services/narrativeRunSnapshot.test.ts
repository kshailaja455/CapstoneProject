import assert from "node:assert/strict";
import test from "node:test";

import { analyzeNarratives, buildCandidateCorpusStats, buildEventFeatures, NARRATIVE_CLASSIFIER_VERSION } from "./narrativeEngine";
import { compareNarrativeVersions, pinnedInputFingerprint, snapshotIntegrityIssues, type PinnedSnapshot } from "./narrativeRunSnapshot";

function fixture(): PinnedSnapshot {
  return {
    clusters: [
      { _id: "historic-c1", generationId: "generation-old", label: "Compass listing", topTerms: ["Compass", "listing"], articleIds: ["a1"] },
      { _id: "historic-c2", generationId: "generation-old", label: "Compass listing", topTerms: ["Compass", "listing"], articleIds: ["a2"] },
    ],
    articles: [
      { _id: "a1", title: "Compass Group plans US share listing", summary: "The company has filed to list shares in New York.", body: "Compass Group plans a US listing. ".repeat(8), source: "Publisher A", url: "https://example.test/compass", publishedAt: new Date("2026-11-20T10:00:00Z"), contentHash: "hash-a1" },
      { _id: "a2", title: "Compass Group plans US share listing", summary: "Compass Group confirms the planned US listing.", body: "Compass Group confirms its US listing plan. ".repeat(8), source: "Publisher B", url: "https://example.test/compass-confirmed", publishedAt: new Date("2026-11-20T12:00:00Z"), contentHash: "hash-a2" },
    ],
    missingArticleIds: [],
  };
}

function evaluate(snapshot: PinnedSnapshot, threshold: number) {
  const corpusArticles = snapshot.articles.map((article) => ({ title: article.title, summary: article.summary, body: article.body }));
  const candidateCorpusStats = buildCandidateCorpusStats(corpusArticles);
  const byId = new Map(snapshot.articles.map((article) => [article._id, article]));
  const events = snapshot.clusters.map((cluster) => buildEventFeatures({
    clusterId: cluster._id, label: cluster.label, topTerms: cluster.topTerms, articleIds: cluster.articleIds,
    articles: cluster.articleIds.map((id: string) => byId.get(id)!).filter(Boolean).map((article: any) => ({ ...article, narrativeArticleId: article._id })),
    corpusArticles, candidateCorpusStats,
  }));
  return analyzeNarratives(events, threshold);
}

test("pinned snapshot fingerprint is stable and captures article content and membership", () => {
  const snapshot = fixture();
  const expected = { clusterIds: ["historic-c1", "historic-c2"], articleIds: ["a1", "a2"], fingerprint: pinnedInputFingerprint(snapshot) };
  assert.equal(snapshotIntegrityIssues(snapshot, expected).fingerprintMatches, true);
  const changed = structuredClone(snapshot);
  changed.articles[0]!.body += "Changed after original run.";
  assert.equal(snapshotIntegrityIssues(changed, expected).fingerprintMatches, false);
  const changedMembership = structuredClone(snapshot);
  changedMembership.clusters[0]!.articleIds = [];
  assert.equal(snapshotIntegrityIssues(changedMembership, expected).fingerprintMatches, false);
});

test("later live Article and Cluster edits do not alter replay evaluation from saved inputs", () => {
  const pinned = fixture();
  const baseline = evaluate(pinned, 42);
  const changedLiveRecords = structuredClone(pinned);
  changedLiveRecords.articles[0]!.body = "New content written after the run.";
  changedLiveRecords.clusters[0]!.articleIds = [];
  // Replay consumes the retained snapshot; current records are not an argument.
  const replay = evaluate(pinned, 42);
  assert.deepEqual(replay.candidateDecisions, baseline.candidateDecisions);
  assert.deepEqual(replay.relationships, baseline.relationships);
  assert.notEqual(pinnedInputFingerprint(changedLiveRecords), pinnedInputFingerprint(pinned));
});

test("same pinned inputs and versions reproduce equivalent machine evaluation", () => {
  const snapshot = fixture();
  const first = evaluate(snapshot, 42);
  const second = evaluate(structuredClone(snapshot), 42);
  assert.equal(NARRATIVE_CLASSIFIER_VERSION, "article-evidence-v1");
  assert.deepEqual(first.candidateDiagnostics, second.candidateDiagnostics);
  assert.deepEqual(first.candidateDecisions, second.candidateDecisions);
  assert.deepEqual(first.relationships, second.relationships);
  assert.ok(first.relationships.length > 0, "fixture should exercise a reproduced classification");
  assert.deepEqual(first.children, second.children);
  assert.deepEqual(first.parents, second.parents);
});

test("replay threshold comes from the pinned run rather than current environment defaults", () => {
  const snapshot = fixture();
  const pinnedThreshold = 42;
  const replay = evaluate(snapshot, pinnedThreshold);
  const changedConfiguration = evaluate(snapshot, 55);
  assert.equal(replay.candidateDiagnostics.threshold, 42);
  assert.equal(changedConfiguration.candidateDiagnostics.threshold, 55);
});

test("missing pinned documents are reported rather than filled from current inputs", () => {
  const snapshot = fixture();
  const issues = snapshotIntegrityIssues({ ...snapshot, articles: [] }, {
    clusterIds: ["historic-c1", "historic-c2"], articleIds: ["a1", "a2"], fingerprint: pinnedInputFingerprint(snapshot),
  });
  assert.deepEqual(issues.missingArticleIds, ["a1", "a2"]);
  assert.equal(issues.fingerprintMatches, false);
});

test("pinned replay remains tied to its inactive historical generation", () => {
  const snapshot = fixture();
  const latestActiveGeneration = "generation-new";
  assert.notEqual(snapshot.clusters[0]!.generationId, latestActiveGeneration);
  assert.equal(snapshotIntegrityIssues(snapshot, {
    clusterIds: ["historic-c1", "historic-c2"], articleIds: ["a1", "a2"], fingerprint: pinnedInputFingerprint(snapshot),
  }).fingerprintMatches, true);
});

test("version comparison reports classifier and gate drift without relabeling it as reproduction", () => {
  assert.deepEqual(compareNarrativeVersions(
    { classifier: "classifier-old", gate: "gate-v2" },
    { classifier: "classifier-new", gate: "gate-v2" },
  ), { classifier: true, gate: false });
});
