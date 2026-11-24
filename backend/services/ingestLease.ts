import { randomUUID } from "node:crypto";

import ClusterGenerationControl from "../models/ClusterGenerationControl";

export const INGEST_CONTROL_ID = "cluster-lifecycle";

export type IngestionLease = {
  owner: string;
  fencingToken: number;
  leaseExpiresAt: Date;
};

export interface IngestionLeaseStore {
  acquire(owner: string, leaseMs: number): Promise<IngestionLease | null>;
  renew(lease: IngestionLease, leaseMs: number, jobId?: string): Promise<boolean>;
  release(lease: IngestionLease, jobId?: string): Promise<boolean>;
  attachJob(lease: IngestionLease, jobId: string): Promise<boolean>;
  current(): Promise<any | null>;
}

export class IngestionLeaseCoordinator {
  constructor(private readonly store: IngestionLeaseStore, private readonly leaseMs = 120_000) {}

  acquire(owner: string = randomUUID()) {
    return this.store.acquire(owner, this.leaseMs);
  }

  renew(lease: IngestionLease, jobId?: string) {
    return this.store.renew(lease, this.leaseMs, jobId);
  }

  release(lease: IngestionLease, jobId?: string) {
    return this.store.release(lease, jobId);
  }

  attachJob(lease: IngestionLease, jobId: string) {
    return this.store.attachJob(lease, jobId);
  }

  current() {
    return this.store.current();
  }
}

export const mongoIngestionLeaseStore: IngestionLeaseStore = {
  async acquire(owner, leaseMs) {
    const now = new Date();
    try {
      await ClusterGenerationControl.updateOne(
        { _id: INGEST_CONTROL_ID },
        { $setOnInsert: { activeGenerationId: null, fencingToken: 0 } },
        { upsert: true },
      );
    } catch (error: any) {
      if (error?.code !== 11000) throw error;
    }
    const control: any = await ClusterGenerationControl.findOneAndUpdate(
      {
        _id: INGEST_CONTROL_ID,
        $or: [
          { leaseExpiresAt: { $exists: false } },
          { leaseExpiresAt: null },
          { leaseExpiresAt: { $lte: now } },
        ],
      },
      {
        $inc: { fencingToken: 1 },
        $set: {
          leaseOwner: owner,
          leaseExpiresAt: new Date(now.getTime() + leaseMs),
          leasePurpose: "INGESTION",
          activeIngestJobId: null,
        },
      },
      { new: true, upsert: false },
    ).lean();
    if (!control || control.leaseOwner !== owner) return null;
    return { owner, fencingToken: control.fencingToken, leaseExpiresAt: control.leaseExpiresAt };
  },

  async renew(lease, leaseMs, jobId) {
    const now = new Date();
    const filter: any = {
      _id: INGEST_CONTROL_ID,
      leaseOwner: lease.owner,
      fencingToken: lease.fencingToken,
      leaseExpiresAt: { $gt: now },
    };
    if (jobId) filter.activeIngestJobId = jobId;
    const result = await ClusterGenerationControl.updateOne(filter, {
      $set: { leaseExpiresAt: new Date(now.getTime() + leaseMs) },
    });
    return result.matchedCount === 1;
  },

  async release(lease, jobId) {
    const filter: any = {
      _id: INGEST_CONTROL_ID,
      leaseOwner: lease.owner,
      fencingToken: lease.fencingToken,
    };
    if (jobId) filter.activeIngestJobId = jobId;
    const result = await ClusterGenerationControl.updateOne(filter, {
      $unset: { leaseOwner: "", leaseExpiresAt: "", leasePurpose: "", activeIngestJobId: "" },
    });
    return result.matchedCount === 1;
  },

  async attachJob(lease, jobId) {
    const result = await ClusterGenerationControl.updateOne({
      _id: INGEST_CONTROL_ID,
      leaseOwner: lease.owner,
      fencingToken: lease.fencingToken,
      leaseExpiresAt: { $gt: new Date() },
    }, { $set: { activeIngestJobId: jobId } });
    return result.matchedCount === 1;
  },

  async current() {
    return ClusterGenerationControl.findById(INGEST_CONTROL_ID).lean();
  },
};

export const ingestionLeaseCoordinator = new IngestionLeaseCoordinator(
  mongoIngestionLeaseStore,
  Math.max(30, Number(process.env.INGESTION_LEASE_SECONDS || 120)) * 1000,
);
