import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Response } from "express";

import IngestJob from "../models/IngestJob";
import NarrativeRun from "../models/NarrativeRun";
import ClusterGenerationControl from "../models/ClusterGenerationControl";
import { runNarrativeAnalysis } from "./narrativeService";
import { ingestionLeaseCoordinator, INGEST_CONTROL_ID, type IngestionLease } from "./ingestLease";
import { canClaimPostIngestNarrative, postIngestNarrativeClaimQuery } from "./ingestRecovery";

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

export class IngestionAlreadyRunningError extends Error {
  constructor(readonly activeJobId: string | null) {
    super("An ingestion operation already holds the distributed lease.");
  }
}

async function transitionOwnedJob(lease: IngestionLease, jobId: string, expectedStatus: "pending" | "running", update: Record<string, any>) {
  const now = new Date();
  const controlFilter: any = {
    _id: INGEST_CONTROL_ID,
    leaseOwner: lease.owner,
    fencingToken: lease.fencingToken,
    activeIngestJobId: jobId,
    leaseExpiresAt: { $gt: now },
  };
  if (update.status === "completed" && update.clusterGenerationId) controlFilter.activeGenerationId = update.clusterGenerationId;
  const transition = await ClusterGenerationControl.updateOne(controlFilter, { $set: {
    lastIngestJobTransition: { jobId, fencingToken: lease.fencingToken, status: update.status, at: now },
  } });
  if (transition.matchedCount !== 1) return false;
  const jobTransition = await IngestJob.updateOne({
    _id: jobId, status: expectedStatus, leaseOwner: lease.owner, fencingToken: lease.fencingToken,
  }, { $set: update });
  return jobTransition.matchedCount === 1;
}

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
  const lease = await ingestionLeaseCoordinator.acquire();
  if (!lease) {
    if (triggeredBy === "scheduled") return null;
    const control: any = await ClusterGenerationControl.findById(INGEST_CONTROL_ID).lean();
    throw new IngestionAlreadyRunningError(control?.activeIngestJobId || null);
  }

  let job: any;
  try {
    job = await IngestJob.create({
      status: "pending", triggeredBy, leaseOwner: lease.owner,
      fencingToken: lease.fencingToken, narrativeStatus: "pending",
    });
    if (!await ingestionLeaseCoordinator.attachJob(lease, job.id)) {
      throw new IngestionAlreadyRunningError(null);
    }
    const started = await IngestJob.updateOne({
      _id: job._id, status: "pending", leaseOwner: lease.owner, fencingToken: lease.fencingToken,
    }, { $set: { status: "running", startedAt: new Date() } });
    if (started.matchedCount !== 1) throw new Error("Could not transition the owned ingestion job to running");
  } catch (error) {
    if (job) await IngestJob.updateOne({ _id: job._id, status: "pending", fencingToken: lease.fencingToken }, {
      $set: { status: "failed", finishedAt: new Date(), error: String((error as any)?.message || error) },
    });
    await ingestionLeaseCoordinator.release(lease);
    throw error;
  }

  const pythonBin = process.env.PYTHON_BIN || "python";
  const scraperPath = process.env.SCRAPER_ENTRYPOINT
    ? path.resolve(process.env.SCRAPER_ENTRYPOINT)
    : path.resolve(projectRoot, "scraper", "pipeline.py");
  const scraperCwd = path.dirname(scraperPath);

  const leaseSeconds = Math.max(30, Number(process.env.INGESTION_LEASE_SECONDS || 120));
  let child: ReturnType<typeof spawn>;
  try {
    child = spawn(pythonBin, [
      scraperPath, "--job-id", job.id, "--lease-owner", lease.owner,
      "--fencing-token", String(lease.fencingToken), "--lease-seconds", String(leaseSeconds),
    ], {
      cwd: scraperCwd,
      env: {
        ...process.env,
        MONGO_URI: process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/news-pulse",
        MONGO_DB: process.env.MONGO_DB || "news-pulse",
        INGESTION_LEASE_OWNER: lease.owner,
        INGESTION_FENCING_TOKEN: String(lease.fencingToken),
        INGESTION_LEASE_SECONDS: String(leaseSeconds),
      },
      stdio: ["ignore", "ignore", "pipe"],
    });
  } catch (error: any) {
    await transitionOwnedJob(lease, job.id, "running", { status: "failed", finishedAt: new Date(), error: error?.message || String(error) });
    await ingestionLeaseCoordinator.release(lease, job.id);
    throw error;
  }

  let stderr = "";
  let settled = false;
  let leaseLost = false;
  const heartbeat = setInterval(() => {
    void ingestionLeaseCoordinator.renew(lease, job.id).then((renewed) => {
      if (!renewed) leaseLost = true;
    }).catch((error) => {
      leaseLost = true;
      console.warn("Ingestion lease renewal failed:", error?.message || error);
    });
  }, Math.max(5000, Math.floor(leaseSeconds * 1000 / 3)));
  heartbeat.unref();

  const finalize = async (code: number | null, processError?: Error) => {
    if (settled) return;
    settled = true;
    try {
      if (processError || code !== 0) {
        const recoveryPending = await IngestJob.exists({
          _id: job._id, status: "running", leaseOwner: lease.owner,
          fencingToken: lease.fencingToken, recoveryStatus: "GENERATION_ACTIVE_REFERENCE_UPDATES_PENDING",
        });
        if (!recoveryPending) {
          await transitionOwnedJob(lease, job.id, "running", {
            status: "failed", finishedAt: new Date(), error: processError?.message || stderr || `Process exited with code ${code}`,
          });
        }
        return;
      }

      const [completedJob, control]: any[] = await Promise.all([
        IngestJob.findOne({ _id: job._id, status: "completed", leaseOwner: lease.owner, fencingToken: lease.fencingToken }).lean(),
        ClusterGenerationControl.findById(INGEST_CONTROL_ID).lean(),
      ]);
      const leaseStillOwned = !leaseLost && control?.leaseOwner === lease.owner
        && control?.fencingToken === lease.fencingToken && control?.activeIngestJobId === job.id
        && control?.leaseExpiresAt && new Date(control.leaseExpiresAt) > new Date();
      if (!completedJob || !leaseStillOwned) return;

      broadcastSSE({
        type: "ingest_completed", jobId: job.id,
        insertedCount: completedJob.insertedCount || 0,
        duplicateCount: completedJob.duplicateCount || 0,
        finishedAt: completedJob.finishedAt,
      });
      await runPostIngestNarrative(job.id, lease, completedJob.clusterGenerationId || null);
    } catch (error: any) {
      console.warn("Post-ingest processing notice:", error?.message || error);
    } finally {
      clearInterval(heartbeat);
      await ingestionLeaseCoordinator.release(lease, job.id);
    }
  };
  child.stderr?.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  child.once("error", async (error) => {
    console.error("Scraper process spawn error:", error);
    await finalize(null, error);
  });

  child.once("close", async (code) => {
    await finalize(code);
  });

  return job;
}

async function runPostIngestNarrative(jobId: string, lease: IngestionLease, generationId: string | null) {
  if (!generationId) {
    await IngestJob.updateOne({ _id: jobId, status: "completed", fencingToken: lease.fencingToken }, {
      $set: { narrativeStatus: "completed", narrativeError: null },
    });
    return { skipped: true, reason: "No versioned cluster generation was produced" };
  }

  const now = new Date();
  const control: any = await ClusterGenerationControl.findById(INGEST_CONTROL_ID).lean();
  if (control?.activeGenerationId !== generationId || control?.leaseOwner !== lease.owner || control?.fencingToken !== lease.fencingToken) {
    await IngestJob.updateOne({ _id: jobId, status: "completed", fencingToken: lease.fencingToken }, {
      $set: { narrativeStatus: "superseded", narrativeError: "The ingestion generation is no longer active." },
    });
    return { skipped: true, reason: "Generation is not active" };
  }

  const completedRun: any = await NarrativeRun.findOne({ ingestJobId: jobId, clusterGenerationId: generationId, status: "completed" }).lean();
  if (completedRun) {
    await IngestJob.updateOne({ _id: jobId, status: "completed", clusterGenerationId: generationId }, {
      $set: { narrativeStatus: "completed", narrativeRunId: completedRun.runId, narrativeError: null },
      $unset: { narrativeAttemptOwner: "", narrativeAttemptExpiresAt: "" },
    });
    return { skipped: true, reason: "A completed post-ingest narrative run already exists", runId: completedRun.runId };
  }

  const attemptOwner = `${lease.owner}:narrative`;
  const claimed: any = await IngestJob.findOneAndUpdate(postIngestNarrativeClaimQuery(jobId, generationId, now) as any, {
    $set: { narrativeStatus: "running", narrativeAttemptOwner: attemptOwner, narrativeAttemptExpiresAt: new Date(now.getTime() + 10 * 60_000), narrativeError: null },
    $inc: { narrativeAttempts: 1 },
  }, { new: true }).lean();
  if (!claimed) return { skipped: true, reason: "Post-ingest narrative was already claimed or completed" };

  try {
    const result: any = await runNarrativeAnalysis("post-ingest", {
      jobId, generationId, leaseOwner: lease.owner, fencingToken: lease.fencingToken,
    });
    if (result?.skipped) {
      await IngestJob.updateOne({ _id: jobId, narrativeAttemptOwner: attemptOwner }, {
        $set: { narrativeStatus: "failed", narrativeError: result.reason || "Narrative analysis did not run" },
        $unset: { narrativeAttemptOwner: "", narrativeAttemptExpiresAt: "" },
      });
      return result;
    }
    await IngestJob.updateOne({ _id: jobId, narrativeAttemptOwner: attemptOwner }, {
      $set: { narrativeStatus: "completed", narrativeRunId: result.runId, narrativeError: null },
      $unset: { narrativeAttemptOwner: "", narrativeAttemptExpiresAt: "" },
    });
    return result;
  } catch (error: any) {
    await IngestJob.updateOne({ _id: jobId, narrativeAttemptOwner: attemptOwner }, {
      $set: { narrativeStatus: "failed", narrativeError: error?.message || String(error) },
      $unset: { narrativeAttemptOwner: "", narrativeAttemptExpiresAt: "" },
    });
    throw error;
  }
}

export async function retryPostIngestNarrative(jobId: string) {
  const lease = await ingestionLeaseCoordinator.acquire();
  if (!lease) {
    const control: any = await ClusterGenerationControl.findById(INGEST_CONTROL_ID).lean();
    throw new IngestionAlreadyRunningError(control?.activeIngestJobId || null);
  }
  try {
    if (!await ingestionLeaseCoordinator.attachJob(lease, jobId)) throw new IngestionAlreadyRunningError(null);
    const job: any = await IngestJob.findOne({ _id: jobId, status: "completed" }).lean();
    if (!job || !canClaimPostIngestNarrative(job)) throw new Error("This completed ingestion has no retryable narrative attempt");
    const control: any = await ClusterGenerationControl.findById(INGEST_CONTROL_ID).lean();
    if (control?.activeGenerationId !== job.clusterGenerationId) throw new Error("The completed job generation is no longer active; refusing to analyze an inactive generation");
    return await runPostIngestNarrative(jobId, lease, job.clusterGenerationId);
  } finally {
    await ingestionLeaseCoordinator.release(lease, jobId);
  }
}
