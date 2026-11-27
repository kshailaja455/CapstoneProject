import dotenv from "dotenv";
dotenv.config();

import app from "./app";
import { connectDB } from "./config/db";
import { seedDefaultPublishers } from "./controllers/publisherController";
import { startAutoScheduler } from "./services/ingestService";

const PORT = Number(process.env.PORT) || 5050;

async function start() {
  await connectDB();
  await seedDefaultPublishers();

  if (process.env.AUTO_RSS_POLLING === "true") {
    const intervalMinutes = Number(process.env.RSS_POLL_INTERVAL_MINUTES) || 1;
    startAutoScheduler(intervalMinutes * 60 * 1000);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Traceon News Intelligence Platform API running on port ${PORT}`);
  });
}

start();
