import { Schema, model } from "mongoose";

const NarrativeRunSchema = new Schema({
  runId: { type: String, required: true, unique: true },
  trigger: { type: String, enum: ["startup", "post-ingest", "scheduled", "manual", "replay"], required: true },
  ingestJobId: { type: String, default: null, index: true },
  clusterGenerationId: { type: String, default: null, index: true },
  replayOfRunId: { type: String, default: null, index: true },
  replaySourceVersions: { type: Schema.Types.Mixed, default: null },
  runMode: { type: String, enum: ["PRODUCTION", "REPLAY"], default: "PRODUCTION" },
  inputClusterIds: { type: [String], default: [] },
  inputArticleIds: { type: [String], default: [] },
  missingInputArticleIds: { type: [String], default: [] },
  inputFingerprint: { type: String, default: null },
  inputCapturedAt: { type: Date, default: null },
  candidateGateVersion: { type: String, default: null },
  candidateRelevanceThreshold: { type: Number, default: null },
  classifierVersion: { type: String, default: null },
  clusterQualityVersion: { type: String, default: null },
  narrativeRulesVersion: { type: String, default: null },
  runConfiguration: { type: Schema.Types.Mixed, default: null },
  status: { type: String, enum: ["running", "completed", "failed", "skipped"], required: true, index: true },
  shadowMode: { type: Boolean, default: true },
  startedAt: { type: Date, default: Date.now, index: true },
  finishedAt: { type: Date, default: null },
  durationMs: { type: Number, default: null },
  articleCount: { type: Number, default: 0 },
  eventClusterCount: { type: Number, default: 0 },
  candidatePairCount: { type: Number, default: 0 },
  // Bounded gate diagnostics: aggregate counts plus representative exclusions.
  candidateDiagnostics: { type: Schema.Types.Mixed, default: null },
  relationshipCount: { type: Number, default: 0 },
  childNarrativeCount: { type: Number, default: 0 },
  parentNarrativeCount: { type: Number, default: 0 },
  createdNarrativeCount: { type: Number, default: 0 },
  error: { type: String, default: null },
  errorStack: { type: String, default: null },
  algorithmVersion: { type: String, required: true },
}, { timestamps: true, collection: "narrative_runs" });

NarrativeRunSchema.index({ startedAt: -1 });

export default model("NarrativeRun", NarrativeRunSchema);
