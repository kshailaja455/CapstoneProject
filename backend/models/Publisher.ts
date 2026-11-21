import { Schema, model } from "mongoose";

export interface IFeed {
  _id?: string;
  url: string;
  name?: string;
  category?: string;
  enabled: boolean;
  websubHub?: string | null;
  lastFetchedAt?: Date | null;
  lastStatus?: "healthy" | "warning" | "error" | "pending";
  lastError?: string | null;
  articleCount?: number;
}

const FeedSchema = new Schema(
  {
    url: { type: String, required: true, trim: true },
    name: { type: String, default: "Main Feed" },
    category: { type: String, default: "General" },
    enabled: { type: Boolean, default: true },
    websubHub: { type: String, default: null },
    lastFetchedAt: { type: Date, default: null },
    lastStatus: {
      type: String,
      enum: ["healthy", "warning", "error", "pending"],
      default: "pending",
    },
    lastError: { type: String, default: null },
    articleCount: { type: Number, default: 0 },
  },
  { _id: true }
);

const PublisherSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    homepageUrl: { type: String, default: "" },
    description: { type: String, default: "" },
    language: { type: String, default: "en" },
    enabled: { type: Boolean, default: true },
    health: {
      type: String,
      enum: ["healthy", "warning", "error", "inactive"],
      default: "healthy",
    },
    feeds: [FeedSchema],
    totalStoredCount: { type: Number, default: 0 },
    lastIngestionAt: { type: Date, default: null },
  },
  { timestamps: true }
);

PublisherSchema.index({ enabled: 1 });

export default model("Publisher", PublisherSchema);
