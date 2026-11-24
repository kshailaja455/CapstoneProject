import type { Request, Response } from "express";
import { isValidObjectId } from "mongoose";

import Article from "../models/Article";
import Cluster from "../models/Cluster";
import IngestJob from "../models/IngestJob";
import Publisher from "../models/Publisher";
import { triggerIngest, getSchedulerStatus, sseClients, retryPostIngestNarrative, IngestionAlreadyRunningError } from "../services/ingestService";
import { notFound, serverError } from "../utils/api";

export async function triggerIngestJob(req: Request, res: Response) {
  try {
    const job = await triggerIngest("manual");
    if (!job) return res.status(409).json({ success: false, error: "Ingestion is already running." });
    return res.status(202).json({
      success: true,
      data: {
        jobId: job.id,
        status: job.status,
      },
    });
  } catch (error) {
    if (error instanceof IngestionAlreadyRunningError) {
      return res.status(409).json({ success: false, error: error.message, activeJobId: error.activeJobId });
    }
    return serverError(res, error);
  }
}

export async function retryIngestNarrative(req: Request, res: Response) {
  try {
    if (!isValidObjectId(req.params.jobId)) return notFound(res, "Ingest job not found");
    const result = await retryPostIngestNarrative(String(req.params.jobId));
    return res.json({ success: true, data: result });
  } catch (error: any) {
    if (error instanceof IngestionAlreadyRunningError) {
      return res.status(409).json({ success: false, error: error.message, activeJobId: error.activeJobId });
    }
    if (String(error?.message || "").includes("no retryable") || String(error?.message || "").includes("no longer active")) {
      return res.status(409).json({ success: false, error: error.message });
    }
    return serverError(res, error);
  }
}

export async function getIngestStatus(req: Request, res: Response) {
  try {
    if (!isValidObjectId(req.params.jobId)) {
      return notFound(res, "Ingest job not found");
    }

    const job = await IngestJob.findById(req.params.jobId).lean();
    if (!job) {
      return notFound(res, "Ingest job not found");
    }

    return res.json({
      success: true,
      data: {
        id: job._id.toString(),
        status: job.status,
        startedAt: job.startedAt,
        finishedAt: job.finishedAt,
        insertedCount: job.insertedCount || 0,
        clusterCount: job.clusterCount || 0,
        error: job.error || null,
        clusterGenerationId: job.clusterGenerationId || null,
        narrativeStatus: job.narrativeStatus || null,
        narrativeRunId: job.narrativeRunId || null,
        narrativeError: job.narrativeError || null,
      },
    });
  } catch (error) {
    return serverError(res, error);
  }
}

export async function getIngestSummary(_req: Request, res: Response) {
  try {
    const totalStored = await Article.countDocuments();
    const latestJob = await IngestJob.findOne({ status: "completed" })
      .sort({ finishedAt: -1 })
      .lean();

    return res.json({
      success: true,
      data: {
        totalStoredArticles: totalStored,
        newlyDiscovered: latestJob?.insertedCount ?? 0,
        duplicateArticlesSkipped: latestJob?.duplicateCount ?? 0,
        failedFeedRequests: latestJob?.failedFeedCount ?? 0,
        lastSuccessfulCollectionAt: latestJob?.lastSuccessfulCollectionAt ?? latestJob?.finishedAt ?? null,
      },
    });
  } catch (error) {
    return serverError(res, error);
  }
}

export async function getLiveArticles(req: Request, res: Response) {
  try {
    const limit = Math.min(250, Math.max(10, Number(req.query.limit) || 100));
    const filter: any = {};
    if (req.query.publisher && req.query.publisher !== "all") {
      filter.source = req.query.publisher;
    }
    if (req.query.sourceCategory && req.query.sourceCategory !== "all") {
      filter.sourceCategory = req.query.sourceCategory;
    }

    const rawArticles = await Article.find(filter)
      .sort({ publishedAt: -1, discoveredAt: -1, createdAt: -1 })
      .limit(limit)
      .populate("clusterId", "label")
      .lean();

    const formatted = rawArticles.map((art: any) => ({
      id: art._id.toString(),
      headline: art.title,
      publisher: art.source,
      sourceCategory: art.sourceCategory || "Media",
      country: art.country || "Global",
      publicationTimestamp: art.publishedAt || art.createdAt,
      discoveryTimestamp: art.discoveredAt || art.createdAt,
      ingestionTimestamp: art.fetchedAt || art.createdAt,
      category: art.category || "General",
      language: art.language || "en",
      description: art.summary || "",
      sourceLink: art.url,
      processingStatus: art.processingStatus || (art.clusterId ? "clustered" : "ingested"),
      clusterAssignment: {
        clusterId: art.clusterId ? (art.clusterId._id || art.clusterId).toString() : null,
        clusterLabel: art.clusterId?.label || null,
      },
    }));

    return res.json({
      success: true,
      data: formatted,
    });
  } catch (error) {
    return serverError(res, error);
  }
}

export async function getIngestMonitoring(_req: Request, res: Response) {
  try {
    const publishers = await Publisher.find({}).lean();
    const totalPublishers = publishers.length;
    const activePublishers = publishers.filter((p) => p.enabled).length;

    let totalFeeds = 0;
    let healthyFeeds = 0;
    for (const p of publishers) {
      for (const f of p.feeds || []) {
        totalFeeds++;
        if (f.enabled && f.lastStatus === "healthy") healthyFeeds++;
      }
    }

    const latestJobs = await IngestJob.find({})
      .sort({ startedAt: -1 })
      .limit(10)
      .lean();

    const latestCompleted = latestJobs.find((j) => j.status === "completed");
    const totalStored = await Article.countDocuments();
    const scheduler = getSchedulerStatus();

    const healthSummary = publishers.map((p) => ({
      id: p._id.toString(),
      name: p.name,
      slug: p.slug,
      enabled: p.enabled,
      health: p.health || "healthy",
      feedCount: (p.feeds || []).length,
      lastIngestionAt: p.lastIngestionAt,
      articleCount: p.totalStoredCount || 0,
      feeds: (p.feeds || []).map((f) => ({
        url: f.url,
        category: f.category,
        enabled: f.enabled,
        lastStatus: f.lastStatus,
        lastError: f.lastError,
      })),
    }));

    return res.json({
      success: true,
      data: {
        scheduler,
        activePublishers,
        totalPublishers,
        totalFeeds,
        healthyFeeds,
        totalStoredArticles: totalStored,
        lastIngestion: latestCompleted?.finishedAt || null,
        nextScheduledIngestion: scheduler.nextRunAt,
        newlyDiscoveredArticles: latestCompleted?.insertedCount ?? 0,
        duplicateArticlesSkipped: latestCompleted?.duplicateCount ?? 0,
        failedFeeds: latestCompleted?.failedFeedCount ?? 0,
        recentIngestionHistory: latestJobs.map((j) => ({
          id: j._id.toString(),
          status: j.status,
          triggeredBy: j.triggeredBy || "manual",
          startedAt: j.startedAt,
          finishedAt: j.finishedAt,
          insertedCount: j.insertedCount || 0,
          duplicateCount: j.duplicateCount || 0,
          failedFeedCount: j.failedFeedCount || 0,
          clusterCount: j.clusterCount || 0,
          error: j.error || null,
        })),
        publishersHealth: healthSummary,
      },
    });
  } catch (error) {
    return serverError(res, error);
  }
}

export function liveStreamSSE(req: Request, res: Response) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  // Send initial ping
  res.write(`data: ${JSON.stringify({ type: "connected", timestamp: new Date() })}\n\n`);

  const clientId = Date.now() + "_" + Math.random().toString(36).substring(2, 7);
  sseClients.set(clientId, res);

  req.on("close", () => {
    sseClients.delete(clientId);
  });
}
