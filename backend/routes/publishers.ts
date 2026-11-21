import { Router } from "express";

import {
  createPublisher,
  deletePublisher,
  getPublisher,
  getPublishers,
  testFeedUrl,
  togglePublisher,
  updatePublisher,
} from "../controllers/publisherController";

const router = Router();

router.get("/publishers", getPublishers);
router.post("/publishers", createPublisher);
router.post("/publishers/test-feed", testFeedUrl);
router.get("/publishers/:id", getPublisher);
router.put("/publishers/:id", updatePublisher);
router.patch("/publishers/:id/toggle", togglePublisher);
router.delete("/publishers/:id", deletePublisher);

export default router;

