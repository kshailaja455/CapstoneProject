import assert from "node:assert/strict";
import test from "node:test";

import { IngestionLeaseCoordinator, type IngestionLease, type IngestionLeaseStore } from "./ingestLease";
import { canClaimPostIngestNarrative, classifyIngestRecovery, matchesQuery, postIngestNarrativeClaimQuery } from "./ingestRecovery";

class SharedLeaseStore implements IngestionLeaseStore {
  token = 0;
  owner: string | null = null;
  expiresAt = 0;
  activeJobId: string | undefined;
  async acquire(owner: string, leaseMs: number): Promise<IngestionLease | null> {
    if (this.owner && this.expiresAt > Date.now()) return null;
    this.owner = owner;
    this.token += 1;
    this.expiresAt = Date.now() + leaseMs;
    this.activeJobId = undefined;
    return { owner, fencingToken: this.token, leaseExpiresAt: new Date(this.expiresAt) };
  }
  async renew(lease: IngestionLease, leaseMs: number, jobId?: string) {
    if (this.owner !== lease.owner || this.token !== lease.fencingToken || this.expiresAt <= Date.now()) return false;
    if (jobId && this.activeJobId !== jobId) return false;
    this.expiresAt = Date.now() + leaseMs;
    return true;
  }
  async release(lease: IngestionLease, jobId?: string) {
    if (this.owner !== lease.owner || this.token !== lease.fencingToken || (jobId && this.activeJobId !== jobId)) return false;
    this.owner = null;
    this.expiresAt = 0;
    this.activeJobId = undefined;
    return true;
  }
  async attachJob(lease: IngestionLease, jobId: string) {
    if (this.owner !== lease.owner || this.token !== lease.fencingToken || this.expiresAt <= Date.now()) return false;
    this.activeJobId = jobId;
    return true;
  }
  async current() { return { owner: this.owner, token: this.token, expiresAt: this.expiresAt, activeJobId: this.activeJobId }; }
}

test("simultaneous scheduler ticks and manual requests share one distributed lease", async () => {
  const sharedStore = new SharedLeaseStore();
  const backendA = new IngestionLeaseCoordinator(sharedStore, 30_000);
  const backendB = new IngestionLeaseCoordinator(sharedStore, 30_000);
  const requests = await Promise.all([
    backendA.acquire("scheduler-a"),
    backendB.acquire("scheduler-b"),
    backendA.acquire("manual-a"),
  ]);
  assert.equal(requests.filter(Boolean).length, 1);
});

test("multiple backend instances cannot publish after lease expiry and a newer fence", async () => {
  const store = new SharedLeaseStore();
  const first = new IngestionLeaseCoordinator(store, 30_000);
  const second = new IngestionLeaseCoordinator(store, 30_000);
  const oldLease = await first.acquire("backend-old");
  assert.ok(oldLease);
  store.expiresAt = Date.now() - 1;
  const newLease = await second.acquire("backend-new");
  assert.ok(newLease);
  assert.equal(await first.renew(oldLease!, "old-job"), false);
  assert.equal(await first.release(oldLease!, "old-job"), false);
  assert.equal(store.owner, "backend-new");
  assert.equal(store.token, 2);
});

test("narrative claim is atomic, duplicate triggers are rejected, and failed runs can retry", async () => {
  const job: any = { _id: "job-1", status: "completed", clusterGenerationId: "gen-1", narrativeStatus: "pending" };
  const claim = async (owner: string) => {
    const query = postIngestNarrativeClaimQuery(job._id, job.clusterGenerationId);
    if (!matchesQuery(job, query)) return false;
    job.narrativeStatus = "running";
    job.narrativeAttemptOwner = owner;
    job.narrativeAttemptExpiresAt = new Date(Date.now() + 60_000);
    return true;
  };
  const simultaneous = await Promise.all([claim("one"), claim("two")]);
  assert.equal(simultaneous.filter(Boolean).length, 1);
  job.narrativeStatus = "failed";
  delete job.narrativeAttemptExpiresAt;
  assert.equal(canClaimPostIngestNarrative(job), true);
  assert.equal(await claim("retry"), true);
  assert.equal(job.status, "completed"); // Retry never repeats ingestion.
});

test("stale job diagnostics distinguish active, expired, fenced, interrupted, and pending narrative states", () => {
  const now = new Date("2026-11-24T00:00:00Z");
  const base = { _id: "job-1", status: "running", leaseOwner: "owner-a", fencingToken: 4 };
  assert.equal(classifyIngestRecovery(base, {
    leaseOwner: "owner-a", fencingToken: 4, activeIngestJobId: "job-1", leaseExpiresAt: new Date(now.getTime() + 10_000),
  }, null, now), "ACTIVE_VALID_LEASE");
  assert.equal(classifyIngestRecovery(base, { leaseExpiresAt: new Date(now.getTime() - 1) }, null, now), "EXPIRED_LEASE_NO_OWNER_PROCESS_UNVERIFIED");
  assert.equal(classifyIngestRecovery(base, { leaseOwner: "owner-b", fencingToken: 5, leaseExpiresAt: new Date(now.getTime() + 10_000) }, null, now), "FENCED_WORKER_PROCESS_UNVERIFIED");
  assert.equal(classifyIngestRecovery(base, { activeGenerationId: "gen-1" }, {
    ingestJobId: "job-1", generationId: "gen-1", referenceUpdatesComplete: true, ingestionCompletedAt: now,
  }, now), "COMPLETED_INGEST_STATUS_INTERRUPTED");
  assert.equal(classifyIngestRecovery({ ...base, status: "completed", clusterGenerationId: "gen-1", narrativeStatus: "pending" }, {}, null, now), "COMPLETED_NARRATIVE_PENDING");
});
