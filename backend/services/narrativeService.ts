import { createHash, randomUUID } from "node:crypto";

import Article from "../models/Article";
import Cluster from "../models/Cluster";
import ClusterGenerationControl from "../models/ClusterGenerationControl";
import IngestJob from "../models/IngestJob";
import { activeClusterFilter } from "./clusterGeneration";
import Narrative from "../models/Narrative";
import NarrativeEvent from "../models/NarrativeEvent";
import NarrativeLock from "../models/NarrativeLock";
import NarrativeRelationship from "../models/NarrativeRelationship";
import NarrativeRun from "../models/NarrativeRun";
import NarrativeRunInput from "../models/NarrativeRunInput";
import NarrativeRunArtifact from "../models/NarrativeRunArtifact";
import {
  analyzeNarratives,
  buildCandidateCorpusStats,
  candidateRelevanceThreshold,
  NARRATIVE_CLASSIFIER_VERSION,
  NARRATIVE_CANDIDATE_GATE_VERSION,
  NARRATIVE_CLUSTER_QUALITY_VERSION,
  NARRATIVE_RULE_VERSION,
  overlapRatio,
  stableEventKey,
  stableNarrativeKey,
  type EventFeature,
  type NarrativeAnalysis,
} from "./narrativeEngine";
import { pinnedInputFingerprint, pinnedInputIds, type PinnedSnapshot } from "./narrativeRunSnapshot";

function enabled(): boolean {
  return !["false", "0", "off"].includes((process.env.NARRATIVE_ANALYSIS_ENABLED || "true").trim().toLowerCase());
}

function shadowMode(): boolean {
  return !["false", "0", "off"].includes((process.env.NARRATIVE_SHADOW_MODE || "true").trim().toLowerCase());
}

export function narrativeConfig() {
  const intervalValue = Number(process.env.NARRATIVE_POLL_INTERVAL_MINUTES || 15);
  const maxValue = Number(process.env.NARRATIVE_MAX_EVENT_CLUSTERS || 500);
  const staleValue = Number(process.env.NARRATIVE_INACTIVE_DAYS || 45);
  return {
    enabled: enabled(),
    shadowMode: shadowMode(),
    intervalMinutes: Number.isFinite(intervalValue) && intervalValue > 0 ? intervalValue : 15,
    maxEventClusters: Number.isFinite(maxValue) && maxValue > 0 ? Math.min(5000, Math.floor(maxValue)) : 500,
    inactiveDays: Number.isFinite(staleValue) && staleValue > 0 ? Math.min(3650, staleValue) : 45,
    candidateRelevanceThreshold: candidateRelevanceThreshold(),
    algorithmVersion: NARRATIVE_RULE_VERSION,
  };
}

/** Only machine-managed review states may be advanced by a new machine result. */
export function reviewStatusUpdateForMachineRun(current: unknown, changed: boolean): "NEEDS_REVIEW" | undefined {
  if (["CONFIRMED", "REJECTED"].includes(String(current || ""))) return undefined;
  return changed ? "NEEDS_REVIEW" : undefined;
}

export function previousMachineEvaluationSnapshot(previous: Record<string, any>) {
  return {
    classification: previous.classification,
    state: previous.state,
    supportingEntities: previous.supportingEntities || [],
    supportingTerms: previous.supportingTerms || [],
    temporalEvidence: previous.temporalEvidence || {},
    contradictingEvidence: previous.contradictingEvidence || [],
    explanation: previous.explanation || "",
    evidence: previous.evidence || {},
    algorithmVersion: previous.algorithmVersion || null,
    classifierVersion: previous.classifierVersion || null,
    evaluatedAt: previous.lastEvaluatedAt || previous.updatedAt || null,
  };
}

function sha(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function urlSet(values: unknown[]): string[] {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))].sort();
}

function relationshipKey(left: string, right: string): string {
  return `relationship-${sha([left, right].sort().join("|")).slice(0, 24)}`;
}

export function shouldPersistRelationship(leftEventKey: string | undefined, rightEventKey: string | undefined): boolean {
  return Boolean(leftEventKey && rightEventKey && leftEventKey !== rightEventKey);
}

function issueKeysForEvent(event: EventFeature): string[] {
  return [...new Set([
    ...event.issueKeys,
    ...event.terms.filter((term) => term.length >= 8).slice(0, 30).map((term) => `ISSUE:${term}`),
  ])].sort();
}

async function acquireLock(owner: string) {
  const now = new Date();
  await NarrativeLock.deleteOne({ lockKey: "global", expiresAt: { $lte: now } });
  const configuredLockMinutes = Number(process.env.NARRATIVE_LEASE_MINUTES || 30);
  const lockMinutes = Number.isFinite(configuredLockMinutes) ? Math.max(5, configuredLockMinutes) : 30;
  try {
    await NarrativeLock.create({
      lockKey: "global",
      owner,
      expiresAt: new Date(now.getTime() + lockMinutes * 60_000),
    });
    return true;
  } catch (error: any) {
    if (error?.code === 11000) return false;
    throw error;
  }
}

type PostIngestAnalysisContext = {
  jobId: string;
  generationId: string;
  leaseOwner: string;
  fencingToken: number;
};

async function loadCurrentEvents(maxClusters: number, generationId: string | null): Promise<{ events: EventFeature[]; snapshot: PinnedSnapshot }> {
  const initialControl: any = await ClusterGenerationControl.findById("cluster-lifecycle").lean();
  if ((initialControl?.activeGenerationId || null) !== generationId) {
    throw new Error("Active cluster generation changed before narrative input was loaded");
  }
  const generationFilter = activeClusterFilter(generationId);
  const clusters = await Cluster.find({ ...generationFilter, articleIds: { $exists: true, $ne: [] } })
    .sort({ endTime: -1 })
    .limit(maxClusters)
    .lean();
  const articleIds = [...new Set(clusters.flatMap((cluster: any) => (cluster.articleIds || []).map(String)))];
  if (!articleIds.length) {
    const finalControl: any = await ClusterGenerationControl.findById("cluster-lifecycle").lean();
    if ((finalControl?.activeGenerationId || null) !== generationId) throw new Error("Active cluster generation changed during narrative input loading");
    return { events: [], snapshot: { clusters: [], articles: [], missingArticleIds: [] } };
  }
  const articles = await Article.find({ _id: { $in: articleIds } })
    .select("title summary body source url publishedAt fetchedAt contentHash")
    .lean();
  const byId = new Map(articles.map((article: any) => [String(article._id), article]));
  const corpusArticles = articles.map((article: any) => ({
    title: article.title || "",
    summary: article.summary || "",
    body: article.body || "",
  }));
  const candidateCorpusStats = buildCandidateCorpusStats(corpusArticles);
  const events = clusters.map((cluster: any) => {
    const members = (cluster.articleIds || []).map((id: any) => {
      const article = byId.get(String(id));
      return article ? { ...article, narrativeArticleId: String(id) } : null;
    }).filter(Boolean) as Array<Record<string, any>>;
    return {
      clusterId: String(cluster._id),
      label: cluster.label || "Untitled event",
      topTerms: cluster.topTerms || [],
      articleIds: (cluster.articleIds || []).map(String),
      articles: members,
      corpusArticles,
      candidateCorpusStats,
    };
  }).filter((event: any) => event.articles.length > 0)
    .map((event: any) => requireEventFeature(event));
  const finalControl: any = await ClusterGenerationControl.findById("cluster-lifecycle").lean();
  if ((finalControl?.activeGenerationId || null) !== generationId) {
    throw new Error("Active cluster generation changed during narrative input loading");
  }
  const loadedIds = new Set(articles.map((article: any) => String(article._id)));
  const snapshot: PinnedSnapshot = {
    clusters: clusters.map((cluster: any) => ({
      _id: String(cluster._id), generationId: cluster.generationId || null, label: cluster.label || "Untitled event",
      topTerms: cluster.topTerms || [], articleIds: (cluster.articleIds || []).map(String),
    })),
    articles: articles.map((article: any) => ({ ...article, _id: String(article._id), clusterId: article.clusterId ? String(article.clusterId) : null })),
    missingArticleIds: articleIds.filter((id) => !loadedIds.has(id)).sort(),
  };
  return { events, snapshot };
}

// Keep this call explicit so tests exercise the same feature path as live runs.
function requireEventFeature(input: Parameters<typeof import("./narrativeEngine").buildEventFeatures>[0]): EventFeature {
  // Static import avoids runtime plugin/model discovery; kept as a small wrapper
  // to make the query-to-feature boundary easy to inspect.
  return buildEventFeatures(input);
}

import { buildEventFeatures } from "./narrativeEngine";

function selectEventMatches(events: EventFeature[], existing: any[]) {
  const candidates: Array<{ currentIndex: number; existingKey: string; score: number }> = [];
  events.forEach((event, currentIndex) => {
    for (const previous of existing) {
      const score = overlapRatio(event.articleUrls, previous.articleUrls || []);
      if (score > 0) candidates.push({ currentIndex, existingKey: previous.eventKey, score });
    }
  });
  candidates.sort((a, b) => b.score - a.score || a.currentIndex - b.currentIndex);
  const assignedCurrent = new Set<number>();
  const assignedPrevious = new Set<string>();
  const matches = new Map<number, string>();
  const splitFrom = new Map<number, string>();
  const mergedInto = new Map<string, string>();
  for (const candidate of candidates) {
    if (assignedCurrent.has(candidate.currentIndex) || assignedPrevious.has(candidate.existingKey)) continue;
    matches.set(candidate.currentIndex, candidate.existingKey);
    assignedCurrent.add(candidate.currentIndex);
    assignedPrevious.add(candidate.existingKey);
  }
  for (const candidate of candidates) {
    if (!matches.has(candidate.currentIndex) && !splitFrom.has(candidate.currentIndex)) splitFrom.set(candidate.currentIndex, candidate.existingKey);
    const currentMatch = matches.get(candidate.currentIndex);
    if (currentMatch && candidate.existingKey !== currentMatch) mergedInto.set(candidate.existingKey, currentMatch);
  }
  return { matches, splitFrom, mergedInto };
}

async function persistEvents(events: EventFeature[], now: Date) {
  const allUrls = urlSet(events.flatMap((event) => event.articleUrls));
  const existing = allUrls.length
    ? await NarrativeEvent.find({ articleUrls: { $in: allUrls } }).lean()
    : [];
  const matching = selectEventMatches(events, existing);
  const eventKeys = new Map<number, string>();
  const previousByKey = new Map(existing.map((event: any) => [event.eventKey, event]));
  const matchedExisting = new Set<string>();

  for (let index = 0; index < events.length; index += 1) {
    const event = events[index]!;
    const eventKey = matching.matches.get(index) || stableEventKey(event.articleUrls, event.label);
    eventKeys.set(index, eventKey);
    const previous: any = previousByKey.get(eventKey);
    if (previous) matchedExisting.add(eventKey);
    const oldUrls = previous?.articleUrls || [];
    const addedUrls = event.articleUrls.filter((url) => !oldUrls.includes(url));
    const removedUrls = oldUrls.filter((url: string) => !event.articleUrls.includes(url));
    const history: any[] = [];
    if (!previous) {
      history.push({ action: matching.splitFrom.has(index) ? "SPLIT_FROM_EVENT" : "EVENT_DISCOVERED", at: now, details: { splitFromEventKey: matching.splitFrom.get(index) || null } });
    } else if (addedUrls.length || removedUrls.length) {
      history.push({ action: "EVENT_MEMBERSHIP_CHANGED", at: now, details: { addedArticleUrls: addedUrls, removedArticleUrls: removedUrls } });
    }
    await NarrativeEvent.findOneAndUpdate(
      { eventKey },
      {
        $set: {
          fingerprint: event.fingerprint,
          currentClusterId: event.clusterId,
          label: event.label,
          articleIds: event.articleIds,
          articleUrls: event.articleUrls,
          articleFingerprints: event.articleFingerprints,
          facets: event.facets.map((facet) => ({
            facetId: facet.facetId,
            title: facet.title,
            articleUrl: facet.articleUrl,
            source: facet.source,
            publishedAt: facet.publishedAt,
            bodyPresent: facet.bodyPresent,
            qualityFlags: facet.qualityFlags,
            entities: facet.entities,
            terms: facet.terms,
            titleTerms: facet.titleTerms,
          })),
          sources: event.sources,
          publishedAtMin: event.publishedAtMin,
          publishedAtMax: event.publishedAtMax,
          entities: event.entities,
          entityKeys: event.entityKeys,
          terms: event.terms,
          issueKeys: issueKeysForEvent(event),
          categories: event.categories,
          qualityFlags: event.qualityFlags,
          eligibleArticleCount: event.eligibleArticleCount,
          excludedArticleCount: event.excludedArticleCount,
          clusterQuality: event.clusterQuality,
          lastSeenAt: now,
          status: "ACTIVE",
          mergedIntoKey: null,
          splitFromKey: matching.splitFrom.get(index) || previous?.splitFromKey || null,
        },
        $setOnInsert: { firstSeenAt: now },
        ...(history.length ? { $push: { history: { $each: history } } } : {}),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }

  for (const [mergedKey, primaryKey] of matching.mergedInto) {
    const previous: any = previousByKey.get(mergedKey);
    if (!previous || matchedExisting.has(mergedKey)) continue;
    await NarrativeEvent.updateOne({ eventKey: mergedKey }, {
      $set: { status: "MERGED", mergedIntoKey: primaryKey, lastSeenAt: now },
      $push: { history: { action: "EVENT_CLUSTER_MERGED", at: now, details: { mergedIntoEventKey: primaryKey } } },
    });
  }
  return eventKeys;
}

function overlapsByEventKeys(existing: any[], target: string[]) {
  const targetSet = new Set(target);
  return existing.map((doc) => {
    const eventKeys = doc.eventKeys || [];
    const intersection = eventKeys.filter((key: string) => targetSet.has(key)).length;
    return { key: doc.narrativeKey, score: overlapRatio(eventKeys, target), intersection };
  }).filter((candidate) => candidate.intersection > 0).sort((a, b) => b.score - a.score || b.intersection - a.intersection);
}

async function persistNarrativeDoc(input: any, existing: any[], assignedOld: Set<string>, now: Date, shadow: boolean, runId: string) {
  const membership = input.level === "PARENT" ? (input.childKeys || []) : (input.eventKeys || []);
  const candidates = overlapsByEventKeys(existing, membership);
  const match = candidates.find((candidate) => !assignedOld.has(candidate.key));
  const key = match?.key || input.deterministicKey;
  if (match) assignedOld.add(match.key);
  const previous: any = existing.find((doc) => doc.narrativeKey === key) || await Narrative.findOne({ narrativeKey: key }).lean();
  const oldMembership = previous?.level === "PARENT" ? previous.childKeys || [] : previous?.eventKeys || [];
  const newMembership = input.level === "PARENT" ? input.childKeys || [] : input.eventKeys || [];
  const changed = JSON.stringify([...oldMembership].sort()) !== JSON.stringify([...newMembership].sort());
  const history: any[] = [];
  if (!previous) {
    history.push({ action: input.splitFromKey ? "NARRATIVE_SPLIT" : "NARRATIVE_DISCOVERED", at: now, details: { splitFromKey: input.splitFromKey || null, runId } });
  } else if (changed || previous.algorithmVersion !== NARRATIVE_RULE_VERSION) {
    history.push({ action: previous.algorithmVersion !== NARRATIVE_RULE_VERSION ? "NARRATIVE_RULE_VERSION_UPDATED" : "NARRATIVE_MEMBERSHIP_CHANGED", at: now, details: { previous: oldMembership, current: newMembership, previousAlgorithmVersion: previous.algorithmVersion, algorithmVersion: NARRATIVE_RULE_VERSION, runId } });
  }
  if (previous?.status === "INACTIVE") history.push({ action: "NARRATIVE_REACTIVATED", at: now, details: { runId } });
  const doc = await Narrative.findOneAndUpdate(
    { narrativeKey: key },
    {
      $set: {
        level: input.level,
        title: input.title,
        summary: input.summary,
        parentKey: input.parentKey || null,
        childKeys: input.childKeys || [],
        eventKeys: input.eventKeys || [],
        entityKeys: input.entityKeys || [],
        issueKeys: input.issueKeys || [],
        categories: input.categories || [],
        sources: input.sources || [],
        articleUrls: input.articleUrls || [],
        status: input.status || "CANDIDATE",
        reviewStatus: changed || previous?.algorithmVersion !== NARRATIVE_RULE_VERSION ? "NEEDS_REVIEW" : (previous?.reviewStatus || "PENDING"),
        shadowMode: shadow,
        algorithmVersion: NARRATIVE_RULE_VERSION,
        lastSeenAt: now,
        lastCoveredAt: input.lastCoveredAt || null,
        lastAnalyzedAt: now,
        mergedIntoKey: null,
        splitFromKey: input.splitFromKey || previous?.splitFromKey || null,
      },
      $setOnInsert: { firstSeenAt: now },
      ...(history.length ? { $push: { history: { $each: history } } } : {}),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();
  return { key, doc, previous, candidates };
}

async function persistNarratives(analysis: NarrativeAnalysis, eventKeys: Map<number, string>, now: Date, shadow: boolean, runId: string) {
  const childDocs: any[] = [];
  let createdCount = 0;
  const existingChildren = await Narrative.find({ level: "CHILD", status: { $nin: ["MERGED", "RETIRED"] }, algorithmVersion: NARRATIVE_RULE_VERSION }).lean();
  const assignedChildren = new Set<string>();
  const createdKeys = new Set<string>();

  for (const group of analysis.children) {
    const stableEventKeys = group.eventIndexes.map((index) => eventKeys.get(index)!).filter(Boolean).sort();
    const eventList = group.eventIndexes.map((index) => analysis.events[index]!);
    const urls = urlSet(eventList.flatMap((event) => event.articleUrls));
    const lastCoveredAt = eventList.map((event) => event.publishedAtMax).filter(Boolean).sort((a: any, b: any) => b.getTime() - a.getTime())[0] || null;
    const matches = overlapsByEventKeys(existingChildren, stableEventKeys);
    const saved = await persistNarrativeDoc({
      deterministicKey: stableNarrativeKey(stableEventKeys, "child"),
      level: "CHILD",
      title: group.title,
      summary: `Candidate storyline containing ${eventList.length} separate event cluster(s). Relationship labels remain unconfirmed until reviewed.`,
      eventKeys: stableEventKeys,
      entityKeys: group.entityKeys,
      issueKeys: [...new Set(eventList.flatMap(issueKeysForEvent))],
      categories: group.categories,
      sources: [...new Set(eventList.flatMap((event) => event.sources))].sort(),
      articleUrls: urls,
      lastCoveredAt,
      splitFromKey: matches[0] && assignedChildren.has(matches[0].key) ? matches[0].key : null,
      status: "CANDIDATE",
    }, existingChildren, assignedChildren, now, shadow, runId);
    if (!saved.previous) createdCount += 1;
    childDocs.push(saved.doc);
    createdKeys.add(saved.key);
    if (matches.length > 1) {
      for (const merged of matches.slice(1)) {
        if (assignedChildren.has(merged.key)) continue;
        assignedChildren.add(merged.key);
        await Narrative.updateOne({ narrativeKey: merged.key }, {
          $set: { status: "MERGED", mergedIntoKey: saved.key },
          $push: { history: { action: "NARRATIVE_MERGED", at: now, details: { mergedIntoKey: saved.key, runId } } },
        });
      }
    }
  }

  const parentDocs: any[] = [];
  const existingParents = await Narrative.find({ level: "PARENT", status: { $nin: ["MERGED", "RETIRED"] }, algorithmVersion: NARRATIVE_RULE_VERSION }).lean();
  const assignedParents = new Set<string>();
  for (const group of analysis.parents) {
    const childKeys = group.childIndexes.map((index) => childDocs[index]?.narrativeKey).filter(Boolean).sort();
    if (childKeys.length < 2) continue;
    const childList = group.childIndexes.map((index) => analysis.children[index]!).filter(Boolean);
    const eventIndexes = [...new Set(childList.flatMap((child) => child.eventIndexes))];
    const eventList = eventIndexes.map((index) => analysis.events[index]!);
    const saved = await persistNarrativeDoc({
      deterministicKey: stableNarrativeKey(childKeys, "parent", group.keys.join("|")),
      level: "PARENT",
      title: group.title,
      summary: `Broader context only. ${childKeys.length} separate child narratives; do not treat as one event or continuing story.`,
      childKeys,
      eventKeys: [],
      entityKeys: [...new Set(eventList.flatMap((event) => event.entityKeys))],
      issueKeys: group.keys,
      categories: [...new Set(eventList.flatMap((event) => event.categories))].sort(),
      sources: [...new Set(eventList.flatMap((event) => event.sources))].sort(),
      articleUrls: urlSet(eventList.flatMap((event) => event.articleUrls)),
      lastCoveredAt: eventList.map((event) => event.publishedAtMax).filter(Boolean).sort((a: any, b: any) => b.getTime() - a.getTime())[0] || null,
      status: "CANDIDATE",
    }, existingParents, assignedParents, now, shadow, runId);
    if (!saved.previous) createdCount += 1;
    parentDocs.push(saved.doc);
    createdKeys.add(saved.key);
  }

  const inactiveBefore = new Date(now.getTime() - narrativeConfig().inactiveDays * 86_400_000);
  await Narrative.updateMany({ level: "CHILD", status: { $in: ["CANDIDATE", "ACTIVE"] }, lastSeenAt: { $lt: inactiveBefore }, narrativeKey: { $nin: [...createdKeys] } }, {
    $set: { status: "INACTIVE" },
    $push: { history: { action: "NARRATIVE_BECAME_INACTIVE", at: now, details: { reason: "No matching current event coverage past inactivity window", runId } } },
  });
  await Narrative.updateMany({ level: "PARENT", status: { $in: ["CANDIDATE", "ACTIVE"] }, lastSeenAt: { $lt: inactiveBefore }, narrativeKey: { $nin: [...createdKeys] } }, {
    $set: { status: "INACTIVE" },
    $push: { history: { action: "NARRATIVE_BECAME_INACTIVE", at: now, details: { reason: "No matching current child narratives past inactivity window", runId } } },
  });
  await Narrative.updateMany({ algorithmVersion: { $ne: NARRATIVE_RULE_VERSION }, status: { $nin: ["MERGED", "SPLIT", "RETIRED"] } }, {
    $set: { status: "RETIRED", reviewStatus: "NEEDS_REVIEW" },
    $push: { history: { action: "NARRATIVE_RULE_VERSION_RETIRED", at: now, details: { previousAlgorithmVersion: "earlier version", currentAlgorithmVersion: NARRATIVE_RULE_VERSION, runId } } },
  });
  return { childDocs, parentDocs, createdCount };
}

async function persistRelationships(analysis: NarrativeAnalysis, eventKeys: Map<number, string>, runId: string, now: Date) {
  for (const relationship of analysis.relationships) {
    const leftEventKey = eventKeys.get(relationship.left);
    const rightEventKey = eventKeys.get(relationship.right);
    // Final persistence-boundary invariant. Historical records are untouched;
    // malformed new self-links are never inserted or updated.
    if (!leftEventKey || !rightEventKey || !shouldPersistRelationship(leftEventKey, rightEventKey)) continue;
    const key = relationshipKey(leftEventKey, rightEventKey);
    const previous: any = await NarrativeRelationship.findOne({ relationshipKey: key }).lean();
    const changed = previous && (previous.classification !== relationship.evaluation.type || previous.state !== relationship.evaluation.state
      || previous.algorithmVersion !== NARRATIVE_RULE_VERSION || previous.classifierVersion !== NARRATIVE_CLASSIFIER_VERSION);
    const reviewStatusUpdate = reviewStatusUpdateForMachineRun(previous?.reviewStatus, Boolean(changed));
    const history = changed ? [{
      classification: relationship.evaluation.type,
      state: relationship.evaluation.state,
      classifierVersion: NARRATIVE_CLASSIFIER_VERSION,
      at: now,
      explanation: relationship.evaluation.explanation,
      runId,
      previousEvaluation: previousMachineEvaluationSnapshot(previous),
    }] : (!previous ? [{ classification: relationship.evaluation.type, state: relationship.evaluation.state, classifierVersion: NARRATIVE_CLASSIFIER_VERSION, at: now, explanation: relationship.evaluation.explanation, runId }] : []);
    await NarrativeRelationship.findOneAndUpdate({ relationshipKey: key }, {
      $set: {
        leftEventKey,
        rightEventKey,
        classification: relationship.evaluation.type,
        state: relationship.evaluation.state,
        supportingEntities: relationship.evaluation.supportingEntities,
        supportingTerms: relationship.evaluation.supportingTerms,
        temporalEvidence: relationship.evaluation.temporalEvidence,
        contradictingEvidence: relationship.evaluation.contradictingEvidence,
        explanation: relationship.evaluation.explanation,
        evidence: relationship.evaluation.evidence,
        candidateRelevance: relationship.candidateRelevance,
        parentKeys: relationship.evaluation.parentKeys,
        algorithmVersion: NARRATIVE_RULE_VERSION,
        classifierVersion: NARRATIVE_CLASSIFIER_VERSION,
        evaluationStatus: "NOT_CALIBRATED",
        lastEvaluatedAt: now,
        runId,
        ...(reviewStatusUpdate ? { reviewStatus: reviewStatusUpdate } : {}),
      },
      $setOnInsert: { firstSeenAt: now, ...(!previous ? { reviewStatus: "PENDING" } : {}) },
      ...(history.length ? { $push: { history: { $each: history } } } : {}),
    }, { upsert: true, new: true, setDefaultsOnInsert: true });
  }
}

export async function runNarrativeAnalysis(
  trigger: "startup" | "post-ingest" | "scheduled" | "manual" = "manual",
  postIngestContext?: PostIngestAnalysisContext,
) {
  const config = narrativeConfig();
  if (!config.enabled) return { enabled: false, skipped: true, reason: "Narrative analysis is disabled." };
  const generationControl: any = await ClusterGenerationControl.findById("cluster-lifecycle").lean();
  const currentGenerationId = generationControl?.activeGenerationId || null;
  const leaseActive = Boolean(generationControl?.leaseOwner && generationControl?.leaseExpiresAt
    && new Date(generationControl.leaseExpiresAt) > new Date());
  if (postIngestContext) {
    const [job, control]: any[] = await Promise.all([
      IngestJob.findOne({ _id: postIngestContext.jobId, status: "completed", clusterGenerationId: postIngestContext.generationId }).lean(),
      ClusterGenerationControl.findById("cluster-lifecycle").lean(),
    ]);
    const leaseMatches = control?.leaseOwner === postIngestContext.leaseOwner
      && control?.fencingToken === postIngestContext.fencingToken
      && control?.activeIngestJobId === postIngestContext.jobId
      && control?.activeGenerationId === postIngestContext.generationId
      && control?.leaseExpiresAt && new Date(control.leaseExpiresAt) > new Date();
    if (!job || !leaseMatches) return { enabled: true, skipped: true, reason: "Completed ingestion lease or generation is no longer current." };
  } else if (leaseActive && generationControl?.leasePurpose === "INGESTION") {
    return { enabled: true, skipped: true, reason: "Ingestion is in progress; narrative analysis was deferred." };
  }
  const owner = randomUUID();
  const locked = await acquireLock(owner);
  if (!locked) return { enabled: true, skipped: true, reason: "Another narrative analysis run holds the lease." };
  // Each execution owns an immutable input snapshot. Ingestion job claims in
  // Phase 3.7 provide deduplication; retries therefore get a new run identity.
  const runId = postIngestContext ? `post-ingest-${postIngestContext.jobId}-${randomUUID()}` : randomUUID();
  const startedAt = new Date();
  await NarrativeRun.findOneAndUpdate({ runId }, {
    $set: {
      trigger, status: "running", shadowMode: config.shadowMode,
      ingestJobId: postIngestContext?.jobId || null,
      clusterGenerationId: postIngestContext?.generationId || currentGenerationId,
      runMode: "PRODUCTION",
      startedAt, finishedAt: null, error: null, errorStack: null,
      algorithmVersion: NARRATIVE_RULE_VERSION,
      candidateGateVersion: NARRATIVE_CANDIDATE_GATE_VERSION,
      candidateRelevanceThreshold: config.candidateRelevanceThreshold,
      classifierVersion: NARRATIVE_CLASSIFIER_VERSION,
      clusterQualityVersion: NARRATIVE_CLUSTER_QUALITY_VERSION,
      narrativeRulesVersion: NARRATIVE_RULE_VERSION,
      runConfiguration: { enabled: config.enabled, intervalMinutes: config.intervalMinutes, maxEventClusters: config.maxEventClusters, inactiveDays: config.inactiveDays, shadowMode: config.shadowMode },
    },
    $setOnInsert: { runId },
  }, { upsert: true, new: true, setDefaultsOnInsert: true });
  const heartbeat = setInterval(() => {
    const minutes = Math.max(5, Number(process.env.NARRATIVE_LEASE_MINUTES || 30));
    void NarrativeLock.updateOne({ lockKey: "global", owner }, { $set: { expiresAt: new Date(Date.now() + minutes * 60_000) } });
  }, 60_000);
  heartbeat.unref();

  try {
    const loaded = await loadCurrentEvents(config.maxEventClusters, postIngestContext?.generationId || currentGenerationId);
    const events = loaded.events;
    const inputCapturedAt = new Date();
    const ids = pinnedInputIds(loaded.snapshot);
    const inputFingerprint = pinnedInputFingerprint(loaded.snapshot);
    if (loaded.snapshot.clusters.length) await NarrativeRunInput.insertMany(loaded.snapshot.clusters.map((payload) => ({ runId, kind: "cluster", refId: String(payload._id), payload })));
    if (loaded.snapshot.articles.length) await NarrativeRunInput.insertMany(loaded.snapshot.articles.map((payload) => ({ runId, kind: "article", refId: String(payload._id), payload })));
    await NarrativeRun.updateOne({ runId }, { $set: {
      inputClusterIds: ids.clusterIds, inputArticleIds: ids.articleIds,
      missingInputArticleIds: loaded.snapshot.missingArticleIds,
      inputFingerprint, inputCapturedAt,
    } });
    const analysis = analyzeNarratives(events, config.candidateRelevanceThreshold);
    const now = new Date();
    const eventKeys = await persistEvents(events, now);
    await persistRelationships(analysis, eventKeys, runId, now);
    const persisted = await persistNarratives(analysis, eventKeys, now, config.shadowMode, runId);
    const articleCount = [...new Set(events.flatMap((event) => event.articleIds))].length;
    const finishedAt = new Date();
    await NarrativeRun.updateOne({ runId }, {
      $set: {
        status: "completed",
        finishedAt,
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        articleCount,
        eventClusterCount: events.length,
        candidatePairCount: analysis.candidatePairCount,
        candidateDiagnostics: analysis.candidateDiagnostics,
        relationshipCount: analysis.relationships.length,
        childNarrativeCount: persisted.childDocs.length,
        parentNarrativeCount: persisted.parentDocs.length,
        createdNarrativeCount: persisted.createdCount,
        inputFingerprint,
      },
    });
    return {
      enabled: true,
      skipped: false,
      runId,
      shadowMode: config.shadowMode,
      articleCount,
      eventClusterCount: events.length,
      candidatePairCount: analysis.candidatePairCount,
      candidateDiagnostics: analysis.candidateDiagnostics,
      relationshipCount: analysis.relationships.length,
      childNarrativeCount: persisted.childDocs.length,
      parentNarrativeCount: persisted.parentDocs.length,
      durationMs: finishedAt.getTime() - startedAt.getTime(),
    };
  } catch (error: any) {
    await NarrativeRun.updateOne({ runId }, {
      $set: {
        status: "failed",
        finishedAt: new Date(),
        durationMs: Date.now() - startedAt.getTime(),
        error: error?.message || String(error),
        errorStack: error?.stack || null,
      },
    });
    throw error;
  } finally {
    clearInterval(heartbeat);
    await NarrativeLock.deleteOne({ lockKey: "global", owner });
  }
}

export function startNarrativeScheduler() {
  const config = narrativeConfig();
  if (!config.enabled) {
    console.log("Narrative analysis is disabled; RSS ingestion remains active");
    return null;
  }
  const timer = setInterval(() => {
    void runNarrativeAnalysis("scheduled").catch((error) => {
      console.error("Narrative analysis failed; RSS ingestion is unaffected", error);
    });
  }, config.intervalMinutes * 60_000);
  timer.unref();
  console.log(`Narrative shadow analysis enabled (every ${config.intervalMinutes} minutes)`);
  return timer;
}
