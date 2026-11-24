export type IngestRecoveryClass =
  | "ACTIVE_VALID_LEASE"
  | "EXPIRED_LEASE_NO_OWNER_PROCESS_UNVERIFIED"
  | "FENCED_WORKER_PROCESS_UNVERIFIED"
  | "COMPLETED_INGEST_STATUS_INTERRUPTED"
  | "COMPLETED_NARRATIVE_PENDING"
  | "ACTIVE_GENERATION_RECOVERY_REQUIRED"
  | "EXECUTION_STATUS_UNCERTAIN";

export function matchesQuery(document: any, query: any): boolean {
  return Object.entries(query).every(([key, expected]: [string, any]) => {
    if (key === "$or") return expected.some((clause: any) => matchesQuery(document, clause));
    const actual = document?.[key];
    if (expected && typeof expected === "object" && !Array.isArray(expected) && !(expected instanceof Date)) {
      return Object.entries(expected).every(([operator, value]: [string, any]) => {
        if (operator === "$exists") return (key in (document || {})) === value;
        if (operator === "$in") return value.includes(actual) || (actual == null && value.includes(null));
        if (operator === "$lte") return actual != null && new Date(actual).getTime() <= new Date(value).getTime();
        return false;
      });
    }
    return actual === expected;
  });
}

export function classifyIngestRecovery(job: any, control: any, generation: any, now = new Date()): IngestRecoveryClass {
  if (job.status === "running" && job.recoveryStatus === "GENERATION_ACTIVE_REFERENCE_UPDATES_PENDING") {
    return "ACTIVE_GENERATION_RECOVERY_REQUIRED";
  }
  if (job.status === "completed" && [undefined, null, "pending", "failed", "running"].includes(job.narrativeStatus)
    && job.clusterGenerationId) {
    return "COMPLETED_NARRATIVE_PENDING";
  }

  const leaseActive = Boolean(control?.leaseOwner && control.leaseExpiresAt && new Date(control.leaseExpiresAt) > now);
  const ownsLease = leaseActive && control.leaseOwner === job.leaseOwner
    && control.fencingToken === job.fencingToken && control.activeIngestJobId === String(job._id);
  if (job.status === "running" && ownsLease) return "ACTIVE_VALID_LEASE";

  const generationProvesCompletion = generation?.ingestJobId === String(job._id)
    && generation?.generationId === control?.activeGenerationId
    && generation?.referenceUpdatesComplete === true
    && Boolean(generation?.ingestionCompletedAt);
  const controlProvesCompletion = control?.lastIngestJobTransition?.jobId === String(job._id)
    && control.lastIngestJobTransition.fencingToken === job.fencingToken
    && control.lastIngestJobTransition.status === "completed";
  if (job.status === "running" && (generationProvesCompletion || controlProvesCompletion
    || job.recoveryStatus === "COMPLETED_AFTER_REFERENCE_RECOVERY")) return "COMPLETED_INGEST_STATUS_INTERRUPTED";

  if (job.status === "running" && (!job.leaseOwner || !Number.isFinite(job.fencingToken))) return "EXECUTION_STATUS_UNCERTAIN";
  if (job.status === "running" && !leaseActive) return "EXPIRED_LEASE_NO_OWNER_PROCESS_UNVERIFIED";
  if (job.status === "running" && control?.fencingToken > (job.fencingToken || 0)) return "FENCED_WORKER_PROCESS_UNVERIFIED";
  return "EXECUTION_STATUS_UNCERTAIN";
}

export function canClaimPostIngestNarrative(job: any, now = new Date()): boolean {
  if (job.status !== "completed" || !job.clusterGenerationId) return false;
  if ([undefined, null, "pending", "failed"].includes(job.narrativeStatus)) return true;
  return job.narrativeStatus === "running"
    && (!job.narrativeAttemptExpiresAt || new Date(job.narrativeAttemptExpiresAt) <= now);
}

export function postIngestNarrativeClaimQuery(jobId: string, generationId: string, now = new Date()) {
  return {
    _id: jobId,
    status: "completed",
    clusterGenerationId: generationId,
    $or: [
      { narrativeStatus: { $in: ["pending", "failed"] } },
      { narrativeStatus: { $exists: false } },
      { narrativeStatus: "running", narrativeAttemptExpiresAt: { $lte: now } },
    ],
  };
}
