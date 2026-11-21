import mongoose from "mongoose";

export let isDbConnected = false;

export async function connectDB() {
  try {
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/news-pulse";

    await mongoose.connect(uri, {
      dbName: process.env.MONGO_DB || "news-pulse",
      serverSelectionTimeoutMS: 2000,
    });

    isDbConnected = true;
    console.log("Mongo connected");
  } catch (err: any) {
    isDbConnected = false;
    console.warn("MongoDB connection note:", err?.message || err);
    console.log("Backend running with fallback data support");
  }
}
