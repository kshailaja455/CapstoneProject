import { Router } from "express";

import { getArticles, getCluster, getClusters, getPlaygroundClusters, getTimeline } from "../controllers/clusterController";

const router = Router();

router.get("/clusters", getClusters);
router.get("/clusters/playground", getPlaygroundClusters);
router.get("/clusters/:id", getCluster);
router.get("/timeline", getTimeline);
router.get("/articles", getArticles);

export default router;
