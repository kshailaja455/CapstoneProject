import { Schema, model } from "mongoose";

const ArticleSchema = new Schema(
  {
    title: { type: String, required: true },
    source: { type: String, required: true },
    url: { type: String, required: true, unique: true },
    summary: { type: String, default: "" },
    body: { type: String, default: "" },
    publishedAt: Date,
    discoveredAt: {
      type: Date,
      default: Date.now,
    },
    fetchedAt: {
      type: Date,
      default: Date.now,
    },
    category: {
      type: String,
      default: "General",
    },
    sourceCategory: {
      type: String,
      default: "Media",
    },
    country: {
      type: String,
      default: "Global",
    },
    language: {
      type: String,
      default: "en",
    },
    processingStatus: {
      type: String,
      enum: ["ingested", "processed", "clustered", "failed"],
      default: "clustered",
    },
    publisherId: {
      type: Schema.Types.ObjectId,
      ref: "Publisher",
      default: null,
    },
    contentHash: String,
    clusterId: {
      type: Schema.Types.ObjectId,
      ref: "Cluster",
      default: null,
    },
    // Monotonic cluster-generation fencing token; prevents an older rebuild
    // from overwriting a newer Article.clusterId during recovery.
    clusterGenerationFence: { type: Number, default: null },
    ingestionFence: { type: Number, default: null },
  },
  { timestamps: true }
);

ArticleSchema.index({ publishedAt: -1 });
ArticleSchema.index({ discoveredAt: -1 });
ArticleSchema.index({ source: 1 });
ArticleSchema.index({ clusterId: 1 });
ArticleSchema.index({ language: 1 });

export default model("Article", ArticleSchema);
