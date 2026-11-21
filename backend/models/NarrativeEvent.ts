import { Schema, model } from "mongoose";

const EntityMentionSchema = new Schema({
  canonical: { type: String, required: true },
  type: { type: String, required: true },
  matchedText: { type: String, required: true },
}, { _id: false });

const NarrativeEventHistorySchema = new Schema({
  action: { type: String, required: true },
  at: { type: Date, default: Date.now },
  details: { type: Schema.Types.Mixed, default: {} },
}, { _id: false });

const NarrativeEventSchema = new Schema({
  eventKey: { type: String, required: true, unique: true },
  fingerprint: { type: String, required: true, index: true },
  currentClusterId: { type: String, default: null },
  label: { type: String, required: true },
  articleIds: { type: [String], default: [] },
  articleUrls: { type: [String], default: [] },
  articleFingerprints: { type: [String], default: [] },
  facets: { type: [Schema.Types.Mixed], default: [] },
  sources: { type: [String], default: [] },
  publishedAtMin: { type: Date, default: null },
  publishedAtMax: { type: Date, default: null },
  entities: { type: [EntityMentionSchema], default: [] },
  entityKeys: { type: [String], default: [] },
  terms: { type: [String], default: [] },
  issueKeys: { type: [String], default: [] },
  categories: { type: [String], default: [] },
  qualityFlags: { type: [String], default: [] },
  eligibleArticleCount: { type: Number, default: 0 },
  excludedArticleCount: { type: Number, default: 0 },
  firstSeenAt: { type: Date, default: Date.now },
  lastSeenAt: { type: Date, default: Date.now, index: true },
  status: { type: String, enum: ["ACTIVE", "INACTIVE", "MERGED", "SPLIT"], default: "ACTIVE", index: true },
  mergedIntoKey: { type: String, default: null },
  splitFromKey: { type: String, default: null },
  history: { type: [NarrativeEventHistorySchema], default: [] },
}, { timestamps: true, collection: "narrative_events" });

NarrativeEventSchema.index({ entityKeys: 1, lastSeenAt: -1 });
NarrativeEventSchema.index({ terms: 1, lastSeenAt: -1 });
NarrativeEventSchema.index({ issueKeys: 1, lastSeenAt: -1 });
NarrativeEventSchema.index({ currentClusterId: 1 });
NarrativeEventSchema.index({ articleUrls: 1 });
NarrativeEventSchema.index({ categories: 1 });
NarrativeEventSchema.index({ sources: 1 });

export default model("NarrativeEvent", NarrativeEventSchema);
