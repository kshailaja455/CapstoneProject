import { Schema, model } from "mongoose";

const RelationshipHistorySchema = new Schema({
  classification: { type: String, required: true },
  state: { type: String, required: true },
  at: { type: Date, default: Date.now },
  explanation: String,
  runId: String,
  classifierVersion: String,
  // Snapshot the previous machine evaluation when a later run replaces it.
  // Reviewer state remains on the relationship and is never part of this update.
  previousEvaluation: { type: Schema.Types.Mixed, default: null },
}, { _id: false });

const NarrativeRelationshipSchema = new Schema({
  relationshipKey: { type: String, required: true, unique: true },
  leftEventKey: { type: String, required: true },
  rightEventKey: { type: String, required: true },
  classification: { type: String, enum: ["SAME_EVENT", "CONTINUING_STORYLINE", "BROADER_CONTEXT_ONLY", "UNRELATED", "INSUFFICIENT_EVIDENCE"], required: true },
  state: { type: String, enum: ["CANDIDATE", "REJECTED", "INSUFFICIENT_EVIDENCE"], required: true, index: true },
  supportingEntities: { type: [Schema.Types.Mixed], default: [] },
  supportingTerms: { type: [String], default: [] },
  temporalEvidence: { type: Schema.Types.Mixed, default: {} },
  contradictingEvidence: { type: [String], default: [] },
  explanation: { type: String, required: true },
  evidence: { type: Schema.Types.Mixed, default: {} },
  // Machine candidate-gate evidence is separate from review fields and decisions.
  candidateRelevance: { type: Schema.Types.Mixed, default: null },
  parentKeys: { type: [String], default: [], index: true },
  reviewStatus: { type: String, enum: ["PENDING", "CONFIRMED", "REJECTED", "NEEDS_REVIEW"], default: "PENDING", index: true },
  reviewedBy: { type: String, default: null },
  reviewedAt: { type: Date, default: null },
  reviewNote: { type: String, default: "" },
  algorithmVersion: { type: String, required: true },
  classifierVersion: { type: String, default: "article-evidence-v1" },
  evaluationStatus: { type: String, default: "NOT_CALIBRATED" },
  firstSeenAt: { type: Date, default: Date.now },
  lastEvaluatedAt: { type: Date, default: Date.now, index: true },
  history: { type: [RelationshipHistorySchema], default: [] },
  runId: { type: String, required: true },
}, { timestamps: true, collection: "narrative_relationships" });

NarrativeRelationshipSchema.index({ leftEventKey: 1, rightEventKey: 1 }, { unique: true });
NarrativeRelationshipSchema.index({ state: 1, classification: 1, lastEvaluatedAt: -1 });
NarrativeRelationshipSchema.index({ "supportingEntities.canonical": 1 });

export default model("NarrativeRelationship", NarrativeRelationshipSchema);
