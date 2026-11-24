import { Schema, model } from "mongoose";

// Immutable, per-run copies of the exact cluster metadata and article text fed
// to feature extraction. One document per record avoids the BSON document cap.
const NarrativeRunInputSchema = new Schema({
  runId: { type: String, required: true, immutable: true, index: true },
  kind: { type: String, enum: ["cluster", "article"], required: true, immutable: true },
  refId: { type: String, required: true, immutable: true },
  payload: { type: Schema.Types.Mixed, required: true, immutable: true },
}, { timestamps: { createdAt: true, updatedAt: false }, collection: "narrative_run_inputs" });
NarrativeRunInputSchema.index({ runId: 1, kind: 1, refId: 1 }, { unique: true });

export default model("NarrativeRunInput", NarrativeRunInputSchema);
