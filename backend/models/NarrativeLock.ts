import { Schema, model } from "mongoose";

const NarrativeLockSchema = new Schema({
  lockKey: { type: String, required: true, unique: true },
  owner: { type: String, required: true },
  expiresAt: { type: Date, required: true },
}, { timestamps: true, collection: "narrative_locks" });

NarrativeLockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default model("NarrativeLock", NarrativeLockSchema);
