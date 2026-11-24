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
      enum: ["manual", "scheduled", "websub"],
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
    recoveryStatus: String,
    recoveryError: String,
    leaseOwner: String,
    fencingToken: Number,
    clusterGenerationId: String,
    narrativeStatus: { type: String, enum: ["pending", "running", "completed", "failed", "superseded"], default: "pending" },
    narrativeRunId: String,
    narrativeAttempts: { type: Number, default: 0 },
    narrativeError: String,
    narrativeAttemptOwner: String,
    narrativeAttemptExpiresAt: Date,
  },
  { timestamps: true }
);

export default model("IngestJob", IngestJobSchema);
