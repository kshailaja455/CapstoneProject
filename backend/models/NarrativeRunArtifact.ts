import { Schema, model } from "mongoose";

// Machine-only replay output. It is deliberately separate from live
// NarrativeRelationship and Narrative collections, including their reviews.
const NarrativeRunArtifactSchema = new Schema({
  runId: { type: String, required: true, immutable: true, index: true },
  artifactType: { type: String, enum: ["candidate", "relationship", "child", "parent"], required: true, immutable: true },
  ordinal: { type: Number, required: true, immutable: true },
  payload: { type: Schema.Types.Mixed, required: true, immutable: true },
}, { timestamps: { createdAt: true, updatedAt: false }, collection: "narrative_run_artifacts" });
NarrativeRunArtifactSchema.index({ runId: 1, artifactType: 1, ordinal: 1 }, { unique: true });

export default model("NarrativeRunArtifact", NarrativeRunArtifactSchema);
