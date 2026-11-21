import { Schema, model } from "mongoose";

const NarrativeRunSchema = new Schema({
  runId: { type: String, required: true, unique: true },
  trigger: { type: String, enum: ["startup", "post-ingest", "scheduled", "manual"], required: true },
  status: { type: String, enum: ["running", "completed", "failed", "skipped"], required: true, index: true },
  shadowMode: { type: Boolean, default: true },
  startedAt: { type: Date, default: Date.now, index: true },
  finishedAt: { type: Date, default: null },
  durationMs: { type: Number, default: null },
  articleCount: { type: Number, default: 0 },
  eventClusterCount: { type: Number, default: 0 },
  candidatePairCount: { type: Number, default: 0 },
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
