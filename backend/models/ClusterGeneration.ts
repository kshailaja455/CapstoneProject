import { Schema, model } from "mongoose";

const ClusterGenerationSchema = new Schema({
  generationId: { type: String, required: true, unique: true, index: true },
  state: { type: String, required: true, index: true },
  fencingToken: { type: Number, required: true },
  ingestJobId: { type: String, default: null, index: true },
  inputArticleIds: { type: [String], required: true },
  inputFingerprint: { type: String, required: true },
  inputArticleCount: { type: Number, required: true },
  expectedClusterCount: { type: Number, default: null },
  clusterIds: { type: [Schema.Types.ObjectId], default: [] },
  referenceUpdatesComplete: { type: Boolean, default: false },
  validation: { type: Schema.Types.Mixed, default: null },
  failureReason: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  validatedAt: { type: Date, default: null },
  activatedAt: { type: Date, default: null },
  referencesCompletedAt: { type: Date, default: null },
  ingestionCompletedAt: { type: Date, default: null },
}, { versionKey: false, collection: "cluster_generations" });

export default model("ClusterGeneration", ClusterGenerationSchema);
