import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Response } from "express";

import Cluster from "../models/Cluster";
import IngestJob from "../models/IngestJob";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, "..");
const projectRoot = path.resolve(backendRoot, "..");

export const sseClients = new Map<string, Response>();

export function broadcastSSE(data: any) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const [id, client] of sseClients.entries()) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(id);
    }
  }
}

let schedulerTimer: NodeJS.Timeout | null = null;
let isSchedulerRunning = false;
let nextScheduledRun: Date | null = null;
let lastRunStartedAt: Date | null = null;

export function getSchedulerStatus() {
  return {
    enabled: isSchedulerRunning,
    intervalMinutes: 1,
    status: isSchedulerRunning ? "active" : "paused",
    lastRunAt: lastRunStartedAt,
    nextRunAt: nextScheduledRun,
    activeSubscribers: sseClients.size,
  };
}

export function startAutoScheduler(intervalMs = 60000) {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
  }
  isSchedulerRunning = true;
  nextScheduledRun = new Date(Date.now() + intervalMs);

  schedulerTimer = setInterval(async () => {
    try {
      lastRunStartedAt = new Date();
      nextScheduledRun = new Date(Date.now() + intervalMs);
      await triggerIngest("scheduled");
    } catch (err: any) {
      console.warn("Scheduled ingestion tick error:", err.message);
    }
  }, intervalMs);

  console.log(`⏱ Automatic RSS Monitoring Scheduler active (interval: ${intervalMs / 1000}s)`);
}

export function stopAutoScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
  isSchedulerRunning = false;
  nextScheduledRun = null;
}

export async function triggerIngest(triggeredBy: "manual" | "scheduled" | "websub" = "manual") {
  const job = await IngestJob.create({
    status: "running",
    startedAt: new Date(),
    triggeredBy,
  });

  const pythonBin = process.env.PYTHON_BIN || "python";
  const scraperPath = process.env.SCRAPER_ENTRYPOINT
    ? path.resolve(process.env.SCRAPER_ENTRYPOINT)
    : path.resolve(projectRoot, "scraper", "pipeline.py");
  const scraperCwd = path.dirname(scraperPath);

  const child = spawn(pythonBin, [scraperPath, "--job-id", job.id], {
    cwd: scraperCwd,
    env: {
      ...process.env,
      MONGO_URI: process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/news-pulse",
      MONGO_DB: process.env.MONGO_DB || "news-pulse",
    },
    stdio: ["ignore", "ignore", "pipe"],
  });

  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  child.on("error", async (error) => {
    console.error("Scraper process spawn error:", error);
    await IngestJob.findByIdAndUpdate(job.id, {
      status: "failed",
      finishedAt: new Date(),
      error: error.message,
    });
  });

  child.on("close", async (code) => {
    if (code === 0) {
      const latest = await IngestJob.findById(job.id);
      if (latest && latest.status === "running") {
        await IngestJob.findByIdAndUpdate(job.id, {
          status: "completed",
          finishedAt: new Date(),
          insertedCount: latest.insertedCount || 0,
          clusterCount: await Cluster.countDocuments(),
        });
      }

      broadcastSSE({
        type: "ingest_completed",
        jobId: job.id,
        insertedCount: latest?.insertedCount || 0,
        duplicateCount: latest?.duplicateCount || 0,
        finishedAt: new Date(),
      });
      return;
    }

    const currentJob = await IngestJob.findById(job.id);
    if (currentJob && currentJob.status === "running") {
      await IngestJob.findByIdAndUpdate(job.id, {
        status: "failed",
        finishedAt: new Date(),
        error: stderr || `Process exited with code ${code}`,
      });
    }
  });

  return job;
}
