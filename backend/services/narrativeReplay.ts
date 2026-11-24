import { randomUUID } from "node:crypto";

import NarrativeRun from "../models/NarrativeRun";
import NarrativeRunInput from "../models/NarrativeRunInput";
import NarrativeRunArtifact from "../models/NarrativeRunArtifact";
import { analyzeNarratives, buildCandidateCorpusStats, buildEventFeatures, NARRATIVE_CANDIDATE_GATE_VERSION, NARRATIVE_CLASSIFIER_VERSION, NARRATIVE_CLUSTER_QUALITY_VERSION, NARRATIVE_RULE_VERSION } from "./narrativeEngine";
import { compareNarrativeVersions, snapshotIntegrityIssues, type PinnedSnapshot } from "./narrativeRunSnapshot";

/** Replay is intentionally isolated from the live NarrativeEvent, Relationship,
 * Narrative and review collections. Only a new run and run artifacts are written. */
export async function replayNarrativeRun(originalRunId: string) {
  const original: any = await NarrativeRun.findOne({ runId: originalRunId }).lean();
  if (!original) throw new Error("Original narrative run was not found");
  if (!original.inputFingerprint || !Array.isArray(original.inputClusterIds) || !Array.isArray(original.inputArticleIds)) {
    throw new Error("This historical run predates pinned inputs and cannot be replayed without substituting live data");
  }
  const replayRunId = `replay-${randomUUID()}`;
  const startedAt = new Date();
  await NarrativeRun.create({
    runId: replayRunId, trigger: "replay", runMode: "REPLAY", replayOfRunId: originalRunId,
    replaySourceVersions: {
      candidateGateVersion: original.candidateGateVersion || null,
      classifierVersion: original.classifierVersion || null,
      clusterQualityVersion: original.clusterQualityVersion || null,
      narrativeRulesVersion: original.narrativeRulesVersion || original.algorithmVersion || null,
    },
    ingestJobId: original.ingestJobId || null, clusterGenerationId: original.clusterGenerationId || null,
    status: "running", shadowMode: true, startedAt,
    inputClusterIds: original.inputClusterIds, inputArticleIds: original.inputArticleIds,
    missingInputArticleIds: original.missingInputArticleIds || [], inputFingerprint: original.inputFingerprint,
    inputCapturedAt: original.inputCapturedAt || null, candidateGateVersion: NARRATIVE_CANDIDATE_GATE_VERSION,
    candidateRelevanceThreshold: original.candidateRelevanceThreshold, classifierVersion: NARRATIVE_CLASSIFIER_VERSION,
    clusterQualityVersion: NARRATIVE_CLUSTER_QUALITY_VERSION, narrativeRulesVersion: NARRATIVE_RULE_VERSION,
    algorithmVersion: NARRATIVE_RULE_VERSION,
    runConfiguration: { sourceRunConfiguration: original.runConfiguration || null, replayMode: "PINNED_INPUT_CURRENT_CODE" },
  });
  try {
    const stored: any[] = await NarrativeRunInput.find({ runId: originalRunId }).lean();
    const snapshot: PinnedSnapshot = {
      clusters: stored.filter((doc) => doc.kind === "cluster").map((doc) => doc.payload),
      articles: stored.filter((doc) => doc.kind === "article").map((doc) => doc.payload),
      missingArticleIds: original.missingInputArticleIds || [],
    };
    const issues = snapshotIntegrityIssues(snapshot, {
      clusterIds: original.inputClusterIds, articleIds: original.inputArticleIds, fingerprint: original.inputFingerprint,
    });
    if (issues.missingClusterIds.length || issues.missingArticleIds.length || issues.unexpectedClusterIds.length || issues.unexpectedArticleIds.length) {
      throw new Error(`Pinned replay inputs unavailable or changed: ${JSON.stringify(issues)}`);
    }
    if (!issues.fingerprintMatches) throw new Error("Pinned replay input fingerprint mismatch; no live data was substituted");
    const byId = new Map(snapshot.articles.map((article) => [String(article._id), article]));
    const corpusArticles = snapshot.articles.map((article) => ({ title: article.title || "", summary: article.summary || "", body: article.body || "" }));
    const candidateCorpusStats = buildCandidateCorpusStats(corpusArticles);
    const events = snapshot.clusters.map((cluster) => ({
      clusterId: String(cluster._id), label: cluster.label || "Untitled event", topTerms: cluster.topTerms || [],
      articleIds: (cluster.articleIds || []).map(String),
      articles: (cluster.articleIds || []).map((id: string) => {
        const article = byId.get(String(id));
        return article ? { ...article, narrativeArticleId: String(id) } : null;
      }).filter(Boolean), corpusArticles, candidateCorpusStats,
    })).filter((event) => event.articles.length > 0).map((event) => buildEventFeatures(event as any));
    const threshold = Number(original.candidateRelevanceThreshold);
    if (!Number.isFinite(threshold)) throw new Error("Pinned run has no candidate threshold; replay cannot use current configuration");
    const analysis = analyzeNarratives(events, threshold);
    const candidateChunks: Array<{ runId: string; artifactType: string; ordinal: number; payload: unknown }> = [];
    for (let offset = 0; offset < analysis.candidateDecisions.length; offset += 10) {
      candidateChunks.push({
        runId: replayRunId, artifactType: "candidate", ordinal: Math.floor(offset / 10),
        payload: analysis.candidateDecisions.slice(offset, offset + 10),
      });
    }
    const artifacts = [
      ...candidateChunks,
      ...analysis.relationships.map((payload, ordinal) => ({ runId: replayRunId, artifactType: "relationship", ordinal, payload })),
      ...analysis.children.map((payload, ordinal) => ({ runId: replayRunId, artifactType: "child", ordinal, payload })),
      ...analysis.parents.map((payload, ordinal) => ({ runId: replayRunId, artifactType: "parent", ordinal, payload })),
    ];
    if (artifacts.length) await NarrativeRunArtifact.insertMany(artifacts);
    const finishedAt = new Date();
    await NarrativeRun.updateOne({ runId: replayRunId }, { $set: {
      status: "completed", finishedAt, durationMs: finishedAt.getTime() - startedAt.getTime(),
      articleCount: snapshot.articles.length, eventClusterCount: events.length,
      candidatePairCount: analysis.candidatePairCount, candidateDiagnostics: analysis.candidateDiagnostics,
      relationshipCount: analysis.relationships.length, childNarrativeCount: analysis.children.length,
      parentNarrativeCount: analysis.parents.length, createdNarrativeCount: 0,
    } });
    const versionDrift = compareNarrativeVersions({
      candidateGate: original.candidateGateVersion,
      classifier: original.classifierVersion,
      clusterQuality: original.clusterQualityVersion,
      narrativeRules: original.narrativeRulesVersion || original.algorithmVersion,
    }, {
      candidateGate: NARRATIVE_CANDIDATE_GATE_VERSION,
      classifier: NARRATIVE_CLASSIFIER_VERSION,
      clusterQuality: NARRATIVE_CLUSTER_QUALITY_VERSION,
      narrativeRules: NARRATIVE_RULE_VERSION,
    });
    return { runId: replayRunId, replayOfRunId: originalRunId, status: "completed", versionDrift, candidateDiagnostics: analysis.candidateDiagnostics, relationshipCount: analysis.relationships.length, childNarrativeCount: analysis.children.length, parentNarrativeCount: analysis.parents.length };
  } catch (error: any) {
    await NarrativeRun.updateOne({ runId: replayRunId }, { $set: { status: "failed", finishedAt: new Date(), error: error?.message || String(error) } });
    throw error;
  }
}
