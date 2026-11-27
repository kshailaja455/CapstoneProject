// Read-only status inspection. This script intentionally issues find/count only.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "backend", "package.json"));
const { MongoClient, ObjectId } = require("mongodb");
require("dotenv").config({ path: path.join(root, "backend", ".env"), quiet: true });

const uri = process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/news-pulse";
const databaseName = process.env.MONGO_DB || "news-pulse";
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 4000, readPreference: "primary" });

function classify(job, control, generation, now) {
  const jobId = String(job._id);
  if (job.status === "running" && job.recoveryStatus === "GENERATION_ACTIVE_REFERENCE_UPDATES_PENDING") return "ACTIVE_GENERATION_RECOVERY_REQUIRED";
  if (job.status === "completed" && job.clusterGenerationId && [undefined, null, "pending", "failed", "running"].includes(job.narrativeStatus)) {
    return "COMPLETED_NARRATIVE_PENDING";
  }
  const activeLease = Boolean(control?.leaseOwner && control.leaseExpiresAt && new Date(control.leaseExpiresAt) > now);
  if (job.status === "running" && activeLease && control.leaseOwner === job.leaseOwner
    && control.fencingToken === job.fencingToken && control.activeIngestJobId === jobId) return "ACTIVE_VALID_LEASE";
  if (job.status === "running" && generation?.ingestJobId === jobId
    && generation.generationId === control?.activeGenerationId && generation.referenceUpdatesComplete
    && generation.ingestionCompletedAt) return "COMPLETED_INGEST_STATUS_INTERRUPTED";
  if (job.status === "running" && control?.lastIngestJobTransition?.jobId === jobId
    && control.lastIngestJobTransition.fencingToken === job.fencingToken
    && control.lastIngestJobTransition.status === "completed") return "COMPLETED_INGEST_STATUS_INTERRUPTED";
  if (job.status === "running" && (!job.leaseOwner || !Number.isFinite(job.fencingToken))) return "EXECUTION_STATUS_UNCERTAIN";
  if (job.status === "running" && !activeLease) return "EXPIRED_LEASE_NO_CURRENT_OWNER_PROCESS_UNVERIFIED";
  if (job.status === "running" && control?.fencingToken > (job.fencingToken || 0)) return "FENCED_WORKER_PROCESS_UNVERIFIED";
  return "EXECUTION_STATUS_UNCERTAIN";
}

try {
  await client.connect();
  const db = client.db(databaseName);
  const [control, runningJobs, pendingNarrativeJobs] = await Promise.all([
    db.collection("cluster_generation_controls").findOne({ _id: "cluster-lifecycle" }),
    db.collection("ingestjobs").find({ status: "running" }).project({ status: 1, startedAt: 1, leaseOwner: 1, fencingToken: 1, recoveryStatus: 1, clusterGenerationId: 1 }).toArray(),
    db.collection("ingestjobs").find({
      status: "completed", clusterGenerationId: { $exists: true, $ne: null },
      narrativeStatus: { $in: ["pending", "failed", "running"] },
    }).project({ status: 1, startedAt: 1, finishedAt: 1, narrativeStatus: 1, clusterGenerationId: 1 }).toArray(),
  ]);
  const ids = runningJobs.map((job) => String(job._id));
  let controlReferencedJob = null;
  if (control?.activeIngestJobId && ObjectId.isValid(control.activeIngestJobId)) {
    const job = await db.collection("ingestjobs").findOne({ _id: new ObjectId(control.activeIngestJobId) }, {
      projection: { status: 1, startedAt: 1, finishedAt: 1, leaseOwner: 1, fencingToken: 1, recoveryStatus: 1 },
    });
    controlReferencedJob = job ? { id: String(job._id), status: job.status, startedAt: job.startedAt || null, recoveryStatus: job.recoveryStatus || null } : null;
  }
  const generations = ids.length
    ? await db.collection("cluster_generations").find({ ingestJobId: { $in: ids } }).toArray()
    : [];
  const byJobId = new Map(generations.map((generation) => [generation.ingestJobId, generation]));
  const now = new Date();
  const counts = {};
  const samples = {};
  for (const job of runningJobs) {
    const label = classify(job, control, byJobId.get(String(job._id)), now);
    counts[label] = (counts[label] || 0) + 1;
    (samples[label] ||= []).push({ id: String(job._id), startedAt: job.startedAt || null });
  }
  console.log(JSON.stringify({
    readOnly: true,
    snapshotAt: now.toISOString(),
    database: databaseName,
    totalRunningJobs: runningJobs.length,
    oldestRunningStartedAt: runningJobs.reduce((oldest, job) => !oldest || job.startedAt < oldest ? job.startedAt : oldest, null),
    newestRunningStartedAt: runningJobs.reduce((newest, job) => !newest || job.startedAt > newest ? job.startedAt : newest, null),
    runningJobClassifications: counts,
    runningJobSamples: Object.fromEntries(Object.entries(samples).map(([key, values]) => [key, values.slice(0, 10)])),
    completedJobsAwaitingNarrative: pendingNarrativeJobs.length,
    completedNarrativeSamples: pendingNarrativeJobs.slice(0, 10).map((job) => ({
      id: String(job._id), status: job.status, narrativeStatus: job.narrativeStatus,
      clusterGenerationId: job.clusterGenerationId, finishedAt: job.finishedAt || null,
    })),
    controlLease: control ? {
      leaseOwnerPresent: Boolean(control.leaseOwner),
      fencingToken: control.fencingToken ?? null,
      leaseExpiresAt: control.leaseExpiresAt || null,
      activeJobId: control.activeIngestJobId || null,
      referencedJob: controlReferencedJob,
      activeGenerationId: control.activeGenerationId || null,
    } : null,
    interpretation: "Expired or missing leases do not prove the operating-system process is gone; old workers are classified as unverified and fenced before publication. No records were updated.",
  }, null, 2));
} finally {
  await client.close();
}
