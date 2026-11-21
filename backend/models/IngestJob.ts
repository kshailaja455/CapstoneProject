import { Schema, model } from "mongoose";

const IngestJobSchema = new Schema(
  {
    status: {
      type: String,
      enum: ["pending", "running", "completed", "failed"],
      default: "pending",
    },

    startedAt: Date,

    finishedAt: Date,

    triggeredBy: {
      type: String,
      enum: ["manual", "scheduled"],
      default: "manual",
    },

    insertedCount: Number,

    duplicateCount: Number,

    failedFeedCount: Number,

    failedFeeds: [{
      source: String,
      error: String,
    }],

    successfulFeedCount: Number,

    totalStoredCount: Number,

    lastSuccessfulCollectionAt: Date,

    clusterCount: Number,

    error: String,
  },
  { timestamps: true }
);

export default model("IngestJob", IngestJobSchema);
