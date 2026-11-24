import assert from "node:assert/strict";
import test from "node:test";

import { narrativeConfig, previousMachineEvaluationSnapshot, reviewStatusUpdateForMachineRun, shouldPersistRelationship } from "./narrativeService";
import { activeClusterFilter } from "./clusterGeneration";

test("current cluster filter excludes staged generations and falls back to legacy clusters", () => {
  assert.deepEqual(activeClusterFilter("generation-2"), { generationId: "generation-2" });
  assert.deepEqual(activeClusterFilter(null), { generationId: { $in: [null] } });
});

test("relationship persistence rejects self-links while allowing distinct event keys", () => {
  assert.equal(shouldPersistRelationship("event-a", "event-a"), false);
  assert.equal(shouldPersistRelationship("event-a", "event-b"), true);
});

test("narrative analysis can be disabled independently of RSS configuration", () => {
  const previous = process.env.NARRATIVE_ANALYSIS_ENABLED;
  process.env.NARRATIVE_ANALYSIS_ENABLED = "false";
  try {
    assert.equal(narrativeConfig().enabled, false);
  } finally {
    if (previous === undefined) delete process.env.NARRATIVE_ANALYSIS_ENABLED;
    else process.env.NARRATIVE_ANALYSIS_ENABLED = previous;
  }
});

test("shadow mode defaults on with a 15-minute scheduled interval", () => {
  const previousEnabled = process.env.NARRATIVE_ANALYSIS_ENABLED;
  const previousShadow = process.env.NARRATIVE_SHADOW_MODE;
  const previousInterval = process.env.NARRATIVE_POLL_INTERVAL_MINUTES;
  const previousThreshold = process.env.NARRATIVE_CANDIDATE_RELEVANCE_THRESHOLD;
  delete process.env.NARRATIVE_ANALYSIS_ENABLED;
  delete process.env.NARRATIVE_SHADOW_MODE;
  delete process.env.NARRATIVE_POLL_INTERVAL_MINUTES;
  delete process.env.NARRATIVE_CANDIDATE_RELEVANCE_THRESHOLD;
  try {
    const config = narrativeConfig();
    assert.equal(config.enabled, true);
    assert.equal(config.shadowMode, true);
    assert.equal(config.intervalMinutes, 15);
    assert.equal(config.candidateRelevanceThreshold, 42);
  } finally {
    if (previousEnabled === undefined) delete process.env.NARRATIVE_ANALYSIS_ENABLED;
    else process.env.NARRATIVE_ANALYSIS_ENABLED = previousEnabled;
    if (previousShadow === undefined) delete process.env.NARRATIVE_SHADOW_MODE;
    else process.env.NARRATIVE_SHADOW_MODE = previousShadow;
    if (previousInterval === undefined) delete process.env.NARRATIVE_POLL_INTERVAL_MINUTES;
    else process.env.NARRATIVE_POLL_INTERVAL_MINUTES = previousInterval;
    if (previousThreshold === undefined) delete process.env.NARRATIVE_CANDIDATE_RELEVANCE_THRESHOLD;
    else process.env.NARRATIVE_CANDIDATE_RELEVANCE_THRESHOLD = previousThreshold;
  }
});

test("candidate relevance threshold follows the existing environment configuration convention", () => {
  const previous = process.env.NARRATIVE_CANDIDATE_RELEVANCE_THRESHOLD;
  process.env.NARRATIVE_CANDIDATE_RELEVANCE_THRESHOLD = "57";
  try {
    assert.equal(narrativeConfig().candidateRelevanceThreshold, 57);
    process.env.NARRATIVE_CANDIDATE_RELEVANCE_THRESHOLD = "140";
    assert.equal(narrativeConfig().candidateRelevanceThreshold, 100);
  } finally {
    if (previous === undefined) delete process.env.NARRATIVE_CANDIDATE_RELEVANCE_THRESHOLD;
    else process.env.NARRATIVE_CANDIDATE_RELEVANCE_THRESHOLD = previous;
  }
});

test("machine updates preserve confirmed and rejected reviewer decisions", () => {
  assert.equal(reviewStatusUpdateForMachineRun("CONFIRMED", true), undefined);
  assert.equal(reviewStatusUpdateForMachineRun("REJECTED", true), undefined);
  assert.equal(reviewStatusUpdateForMachineRun("PENDING", true), "NEEDS_REVIEW");
  assert.equal(reviewStatusUpdateForMachineRun("NEEDS_REVIEW", false), undefined);
});

test("machine reclassification history preserves the previous evidence snapshot", () => {
  const evidence = { supportingArticlePairs: [{ leftArticleId: "a1", rightArticleId: "b1" }] };
  const snapshot = previousMachineEvaluationSnapshot({
    classification: "BROADER_CONTEXT_ONLY", state: "CANDIDATE", supportingEntities: [{ canonical: "Microsoft" }],
    supportingTerms: ["Azure"], temporalEvidence: { gapHours: 120 }, contradictingEvidence: ["none"],
    explanation: "Previous explanation", evidence, algorithmVersion: "rules-en-v1.1.0", classifierVersion: "legacy-single-pair", lastEvaluatedAt: new Date("2026-11-23T12:00:00Z"),
  });
  assert.equal(snapshot.classification, "BROADER_CONTEXT_ONLY");
  assert.equal(snapshot.evidence, evidence);
  assert.deepEqual(snapshot.supportingTerms, ["Azure"]);
  assert.equal(snapshot.algorithmVersion, "rules-en-v1.1.0");
  assert.equal(snapshot.classifierVersion, "legacy-single-pair");
});
