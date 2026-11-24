import { Router } from "express";

import {
  getIngestMonitoring,
  getIngestStatus,
  getIngestSummary,
  getLiveArticles,
  liveStreamSSE,
  triggerIngestJob,
  retryIngestNarrative,
} from "../controllers/ingestController";

const router = Router();

router.post("/ingest/trigger", triggerIngestJob);
router.post("/ingest/status/:jobId/retry-narrative", retryIngestNarrative);
router.get("/ingest/status/:jobId", getIngestStatus);
router.get("/ingest/summary", getIngestSummary);
router.get("/ingest/live", getLiveArticles);
router.get("/ingest/live-stream", liveStreamSSE);
router.get("/ingest/monitoring", getIngestMonitoring);

export default router;
