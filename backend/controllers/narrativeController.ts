import type { Request, Response } from "express";

import Article from "../models/Article";
import Narrative from "../models/Narrative";
import NarrativeEvent from "../models/NarrativeEvent";
import NarrativeRelationship from "../models/NarrativeRelationship";
import NarrativeRun from "../models/NarrativeRun";
import { narrativeConfig, runNarrativeAnalysis } from "../services/narrativeService";
import { notFound, serverError } from "../utils/api";

function limitValue(value: unknown, fallback = 100) {
  const parsed = typeof value === "string" ? Number(value) : fallback;
  return Number.isFinite(parsed) ? Math.max(1, Math.min(500, Math.floor(parsed))) : fallback;
}

async function eventFilter(req: Request) {
  const query: Record<string, any> = {};
  if (typeof req.query.source === "string" && req.query.source.trim()) query.sources = req.query.source.trim();
  if (typeof req.query.from === "string" || typeof req.query.to === "string") {
    query.publishedAtMax = {};
    if (typeof req.query.from === "string") query.publishedAtMax.$gte = new Date(req.query.from);
    if (typeof req.query.to === "string") query.publishedAtMin = { $lte: new Date(req.query.to) };
  }
  const events = await NarrativeEvent.find(query).select("eventKey").lean();
  return events.map((event: any) => event.eventKey as string);
}

export async function getNarrativeStatus(_req: Request, res: Response) {
  try {
    const [latestRun, narrativeCount, relationshipCount] = await Promise.all([
      NarrativeRun.findOne().sort({ startedAt: -1 }).lean(),
      Narrative.countDocuments({ status: { $in: ["CANDIDATE", "ACTIVE"] } }),
      NarrativeRelationship.countDocuments(),
    ]);
    return res.json({ success: true, data: { ...narrativeConfig(), latestRun, narrativeCount, relationshipCount } });
  } catch (error) {
    return serverError(res, error);
  }
}

export async function listNarratives(req: Request, res: Response) {
  try {
    const query: Record<string, any> = {};
    if (typeof req.query.status !== "string") query.status = { $in: ["CANDIDATE", "ACTIVE"] };
    if (typeof req.query.status === "string") query.status = req.query.status.toUpperCase();
    if (typeof req.query.level === "string") query.level = req.query.level.toUpperCase();
    if (typeof req.query.category === "string") query.categories = req.query.category;
    if (typeof req.query.reviewStatus === "string") query.reviewStatus = req.query.reviewStatus.toUpperCase();
    if (typeof req.query.source === "string" || typeof req.query.from === "string" || typeof req.query.to === "string") {
      const eventKeys = await eventFilter(req);
      const childKeys = (await Narrative.find({ eventKeys: { $in: eventKeys }, level: "CHILD" }).select("narrativeKey").lean())
        .map((doc: any) => doc.narrativeKey);
      query.$or = [
        { eventKeys: { $in: eventKeys } },
        { childKeys: { $in: childKeys } },
      ];
    }
    const data = await Narrative.find(query)
      .sort({ lastCoveredAt: -1, lastSeenAt: -1 })
      .limit(limitValue(req.query.limit))
      .lean();
    return res.json({ success: true, data });
  } catch (error) {
    return serverError(res, error);
  }
}

export async function getNarrative(req: Request, res: Response) {
  try {
    const narrative: any = await Narrative.findOne({ narrativeKey: req.params.id }).lean();
    if (!narrative) return notFound(res, "Narrative not found");
    const childDocs = narrative.childKeys?.length
      ? await Narrative.find({ narrativeKey: { $in: narrative.childKeys } }).lean()
      : [];
    const eventKeys = narrative.level === "PARENT"
      ? [...new Set(childDocs.flatMap((child: any) => child.eventKeys || []))]
      : narrative.eventKeys || [];
    const events = await NarrativeEvent.find({ eventKey: { $in: eventKeys } }).sort({ publishedAtMin: 1 }).lean();
    const articleUrls = [...new Set(events.flatMap((event: any) => event.articleUrls || []))];
    const articles = await Article.find({ url: { $in: articleUrls } })
      .select("title source url summary body publishedAt fetchedAt")
      .sort({ publishedAt: 1 })
      .lean();
    const articleByUrl = new Map(articles.map((article: any) => [article.url, article]));
    const eventsWithArticles = events.map((event: any) => ({
      ...event,
      articles: (event.articleUrls || []).map((url: string) => articleByUrl.get(url)).filter(Boolean).map((article: any) => ({
        id: String(article._id),
        title: article.title,
        source: article.source,
        url: article.url,
        summary: article.summary || "",
        bodyExcerpt: (article.body || "").slice(0, 2500),
        publishedAt: article.publishedAt,
      })),
    }));
    const relationships = await NarrativeRelationship.find({
      algorithmVersion: narrativeConfig().algorithmVersion,
      $or: [
        { leftEventKey: { $in: eventKeys } },
        { rightEventKey: { $in: eventKeys } },
      ],
    }).sort({ lastEvaluatedAt: -1 }).limit(250).lean();
    const eventsByKey = new Map(events.map((event: any) => [event.eventKey, event]));
    const relationshipsWithEvents = relationships.map((relationship: any) => ({
      ...relationship,
      leftEvent: eventsByKey.get(relationship.leftEventKey) || null,
      rightEvent: eventsByKey.get(relationship.rightEventKey) || null,
    }));
    return res.json({ success: true, data: { ...narrative, children: childDocs, events: eventsWithArticles, relationships: relationshipsWithEvents } });
  } catch (error) {
    return serverError(res, error);
  }
}

export async function listRelationships(req: Request, res: Response) {
  try {
    const query: Record<string, any> = { algorithmVersion: narrativeConfig().algorithmVersion };
    if (typeof req.query.state === "string") query.state = req.query.state.toUpperCase();
    if (typeof req.query.classification === "string") query.classification = req.query.classification.toUpperCase();
    if (typeof req.query.reviewStatus === "string") query.reviewStatus = req.query.reviewStatus.toUpperCase();
    const matchingKeys = typeof req.query.source === "string" || typeof req.query.from === "string" || typeof req.query.to === "string"
      ? await eventFilter(req)
      : null;
    if (matchingKeys) query.$or = [{ leftEventKey: { $in: matchingKeys } }, { rightEventKey: { $in: matchingKeys } }];
    const relationships = await NarrativeRelationship.find(query)
      .sort({ lastEvaluatedAt: -1 })
      .limit(limitValue(req.query.limit, 150))
      .lean();
    const eventKeys = [...new Set(relationships.flatMap((relationship: any) => [relationship.leftEventKey, relationship.rightEventKey]))];
    const events = await NarrativeEvent.find({ eventKey: { $in: eventKeys } }).select("eventKey label sources publishedAtMin publishedAtMax qualityFlags").lean();
    const byKey = new Map(events.map((event: any) => [event.eventKey, event]));
    return res.json({ success: true, data: relationships.map((relationship: any) => ({
      ...relationship,
      leftEvent: byKey.get(relationship.leftEventKey) || null,
      rightEvent: byKey.get(relationship.rightEventKey) || null,
    })) });
  } catch (error) {
    return serverError(res, error);
  }
}

export async function reviewRelationship(req: Request, res: Response) {
  try {
    const allowed = new Set(["CONFIRMED", "REJECTED", "NEEDS_REVIEW", "PENDING"]);
    const reviewStatus = typeof req.body?.reviewStatus === "string" ? req.body.reviewStatus.toUpperCase() : "";
    if (!allowed.has(reviewStatus)) return res.status(400).json({ success: false, error: "Invalid reviewStatus" });
    const relationship = await NarrativeRelationship.findOneAndUpdate(
      { relationshipKey: req.params.id },
      { $set: { reviewStatus, reviewedAt: new Date(), reviewedBy: "local-review", reviewNote: String(req.body?.note || "").slice(0, 2000) } },
      { new: true },
    ).lean();
    if (!relationship) return notFound(res, "Relationship not found");
    return res.json({ success: true, data: relationship });
  } catch (error) {
    return serverError(res, error);
  }
}

export async function getNarrativeHistory(req: Request, res: Response) {
  try {
    const narrative: any = await Narrative.findOne({ narrativeKey: req.params.id }).lean();
    if (!narrative) return notFound(res, "Narrative not found");
    const childKeys = narrative.level === "PARENT" ? narrative.childKeys || [] : [];
    const events = await NarrativeEvent.find({ eventKey: { $in: narrative.eventKeys || [] } }).select("eventKey label history").lean();
    const children = childKeys.length ? await Narrative.find({ narrativeKey: { $in: childKeys } }).select("narrativeKey title history").lean() : [];
    return res.json({ success: true, data: { narrative: narrative.history || [], events, children } });
  } catch (error) {
    return serverError(res, error);
  }
}

export async function getNarrativeTimeline(req: Request, res: Response) {
  try {
    const narrative: any = await Narrative.findOne({ narrativeKey: req.params.id }).lean();
    if (!narrative) return notFound(res, "Narrative not found");
    const children = narrative.level === "PARENT" && narrative.childKeys?.length
      ? await Narrative.find({ narrativeKey: { $in: narrative.childKeys } }).select("narrativeKey title eventKeys").lean()
      : [];
    const eventKeys = narrative.level === "PARENT"
      ? [...new Set(children.flatMap((child: any) => child.eventKeys || []))]
      : narrative.eventKeys || [];
    const events = await NarrativeEvent.find({ eventKey: { $in: eventKeys } })
      .sort({ publishedAtMin: 1, firstSeenAt: 1 })
      .select("eventKey label sources publishedAtMin publishedAtMax articleUrls qualityFlags history")
      .lean();
    return res.json({ success: true, data: { narrativeKey: narrative.narrativeKey, events } });
  } catch (error) {
    return serverError(res, error);
  }
}

export async function getLatestNarrativeRun(_req: Request, res: Response) {
  try {
    const run = await NarrativeRun.findOne().sort({ startedAt: -1 }).lean();
    return res.json({ success: true, data: run });
  } catch (error) {
    return serverError(res, error);
  }
}

export async function triggerNarrativeAnalysis(_req: Request, res: Response) {
  try {
    if (!narrativeConfig().enabled) return res.status(409).json({ success: false, error: "Narrative analysis is disabled by configuration." });
    const result = await runNarrativeAnalysis("manual");
    return res.status(result.skipped ? 409 : 202).json({ success: true, data: result });
  } catch (error) {
    return serverError(res, error);
  }
}
