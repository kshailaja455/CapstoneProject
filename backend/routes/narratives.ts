import { Router } from "express";

import {
  getLatestNarrativeRun,
  getNarrativeRunArtifacts,
  getNarrative,
  getNarrativeHistory,
  getNarrativeStatus,
  getNarrativeTimeline,
  listNarratives,
  listRelationships,
  reviewRelationship,
  replayNarrativeRunEndpoint,
  triggerNarrativeAnalysis,
} from "../controllers/narrativeController";

const router = Router();

router.get("/narratives/status", getNarrativeStatus);
router.get("/narratives/runs/latest", getLatestNarrativeRun);
router.post("/narratives/runs/:runId/replay", replayNarrativeRunEndpoint);
router.get("/narratives/runs/:runId/artifacts", getNarrativeRunArtifacts);
router.post("/narratives/analyze", triggerNarrativeAnalysis);
router.get("/narratives/relationships", listRelationships);
router.patch("/narratives/relationships/:id/review", reviewRelationship);
router.get("/narratives", listNarratives);
router.get("/narratives/:id/history", getNarrativeHistory);
router.get("/narratives/:id/timeline", getNarrativeTimeline);
router.get("/narratives/:id", getNarrative);

export default router;
