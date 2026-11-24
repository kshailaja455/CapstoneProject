import { Schema, model } from "mongoose";

const ClusterSchema = new Schema(
  {
    // Null/absent for legacy clusters. New clusters are isolated by generation.
    generationId: { type: String, default: null, index: true },
    generationFence: { type: Number, default: null },
    label: String,

    topTerms: [String],

    articleIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "Article",
      },
    ],

    sources: [String],

    articleCount: Number,

    startTime: Date,

    endTime: Date,

    representativeArticleId: {
      type: Schema.Types.ObjectId,
      ref: "Article",
    },
  },
  { timestamps: true }
);

ClusterSchema.index({ generationId: 1, endTime: -1 });

export default model("Cluster", ClusterSchema);
