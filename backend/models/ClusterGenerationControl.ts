import { Schema, model } from "mongoose";

const ClusterGenerationControlSchema = new Schema({
  _id: { type: String, required: true },
  activeGenerationId: { type: String, default: null },
  activeGenerationFence: { type: Number, default: null },
  activeGenerationActivatedAt: { type: Date, default: null },
  fencingToken: { type: Number, default: 0 },
  leaseOwner: { type: String, default: null },
  leaseExpiresAt: { type: Date, default: null },
  leasePurpose: { type: String, default: null },
  activeIngestJobId: { type: String, default: null },
  lastIngestJobTransition: { type: Schema.Types.Mixed, default: null },
}, { versionKey: false, collection: "cluster_generation_controls" });

export default model("ClusterGenerationControl", ClusterGenerationControlSchema);
