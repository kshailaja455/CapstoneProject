import { Schema, model } from "mongoose";

const NarrativeHistorySchema = new Schema({
  action: { type: String, required: true },
  at: { type: Date, default: Date.now },
  details: { type: Schema.Types.Mixed, default: {} },
}, { _id: false });

const NarrativeSchema = new Schema({
  narrativeKey: { type: String, required: true, unique: true },
  level: { type: String, enum: ["PARENT", "CHILD"], required: true },
  title: { type: String, required: true },
  summary: { type: String, default: "" },
  parentKey: { type: String, default: null, index: true },
  childKeys: { type: [String], default: [] },
  eventKeys: { type: [String], default: [] },
  entityKeys: { type: [String], default: [] },
  issueKeys: { type: [String], default: [] },
  categories: { type: [String], default: [] },
  sources: { type: [String], default: [] },
  articleUrls: { type: [String], default: [] },
  status: { type: String, enum: ["CANDIDATE", "ACTIVE", "INACTIVE", "SPLIT", "MERGED", "RETIRED"], default: "CANDIDATE", index: true },
  reviewStatus: { type: String, enum: ["PENDING", "CONFIRMED", "REJECTED", "NEEDS_REVIEW"], default: "PENDING", index: true },
  shadowMode: { type: Boolean, default: true, index: true },
  algorithmVersion: { type: String, required: true },
  firstSeenAt: { type: Date, default: Date.now },
  lastSeenAt: { type: Date, default: Date.now, index: true },
  lastCoveredAt: { type: Date, default: null },
  lastAnalyzedAt: { type: Date, default: Date.now },
  mergedIntoKey: { type: String, default: null },
  splitFromKey: { type: String, default: null },
  history: { type: [NarrativeHistorySchema], default: [] },
}, { timestamps: true, collection: "narratives" });

NarrativeSchema.index({ level: 1, status: 1, lastSeenAt: -1 });
NarrativeSchema.index({ childKeys: 1 });
NarrativeSchema.index({ eventKeys: 1 });
NarrativeSchema.index({ sources: 1 });
NarrativeSchema.index({ categories: 1 });

export default model("Narrative", NarrativeSchema);
