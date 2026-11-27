import type { Request, Response } from "express";
import { XMLParser } from "fast-xml-parser";

import Publisher from "../models/Publisher";
import Article from "../models/Article";
import { detectEnglish, isEnglishLanguageCode } from "../utils/language";
import { isRetiredFeedUrl, isRetiredPublisher } from "../config/retiredPublishers";

const DEFAULT_PUBLISHERS = [
  {
    name: "BBC",
    slug: "bbc",
    homepageUrl: "https://www.bbc.com/news",
    description: "British Broadcasting Corporation - World & UK News",
    language: "en",
    enabled: true,
    feeds: [
      {
        url: "https://feeds.bbci.co.uk/news/rss.xml",
        name: "Top Stories",
        category: "General",
        enabled: true,
        lastStatus: "healthy",
      },
    ],
  },
  {
    name: "NPR",
    slug: "npr",
    homepageUrl: "https://www.npr.org",
    description: "National Public Radio - US & International News",
    language: "en",
    enabled: true,
    feeds: [
      {
        url: "https://feeds.npr.org/1001/rss.xml",
        name: "News",
        category: "General",
        enabled: true,
        lastStatus: "healthy",
      },
    ],
  },
  {
    name: "The Guardian",
    slug: "guardian",
    homepageUrl: "https://www.theguardian.com",
    description: "The Guardian - Global Independent Journalism",
    language: "en",
    enabled: true,
    feeds: [
      {
        url: "https://www.theguardian.com/world/rss",
        name: "World News",
        category: "World",
        enabled: true,
        lastStatus: "healthy",
      },
    ],
  },
];

export async function seedDefaultPublishers() {
  try {
    const count = await Publisher.countDocuments();
    if (count === 0) {
      console.log("Seeding default publishers (BBC, NPR, Guardian)...");
      for (const pub of DEFAULT_PUBLISHERS) {
        await Publisher.create(pub);
      }
      console.log("Default publishers seeded successfully.");
    }
  } catch (err: any) {
    console.warn("Could not seed default publishers:", err.message);
  }
}

export async function getPublishers(req: Request, res: Response) {
  try {
    let publishers = (await Publisher.find({}).sort({ name: 1 }).lean()).filter((publisher) => !isRetiredPublisher(publisher));
    if (publishers.length === 0) {
      await seedDefaultPublishers();
      publishers = (await Publisher.find({}).sort({ name: 1 }).lean()).filter((publisher) => !isRetiredPublisher(publisher));
    }

    // Attach dynamic article counts
    const counts = await Article.aggregate([
      { $group: { _id: "$source", count: { $sum: 1 } } },
    ]);
    const countMap: Record<string, number> = {};
    for (const c of counts) {
      countMap[c._id] = c.count;
    }

    const enriched = publishers.map((p) => {
      const activeFeeds = (p.feeds || []).filter((feed) => !isRetiredFeedUrl(feed.url));
      const artCount = countMap[p.name] ?? (p.totalStoredCount || 0);
      return {
        ...p,
        feeds: activeFeeds,
        articleCount: artCount,
        feedCount: activeFeeds.length,
        activeFeedCount: activeFeeds.filter((f) => f.enabled).length,
      };
    });

    return res.json({ success: true, data: enriched });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function getPublisher(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const publisher = await Publisher.findById(id).lean();
    if (!publisher) {
      return res.status(404).json({ success: false, error: "Publisher not found" });
    }
    return res.json({ success: true, data: publisher });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function createPublisher(req: Request, res: Response) {
  try {
    const { name, homepageUrl, description, language, feeds } = req.body;
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ success: false, error: "Publisher name is required" });
    }

    const cleanName = name.trim();
    const slug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    const existing = await Publisher.findOne({
      $or: [{ name: cleanName }, { slug }],
    });
    if (existing) {
      return res.status(409).json({ success: false, error: `Publisher '${cleanName}' already exists` });
    }

    const cleanFeeds = Array.isArray(feeds)
      ? feeds.map((f: any) => ({
          url: f.url.trim(),
          name: f.name?.trim() || "Main Feed",
          category: f.category?.trim() || "General",
          enabled: f.enabled !== false,
          websubHub: f.websubHub || null,
        }))
      : [];

    const publisher = await Publisher.create({
      name: cleanName,
      slug,
      homepageUrl: homepageUrl?.trim() || "",
      description: description?.trim() || "",
      language: language?.trim() || "en",
      enabled: true,
      health: "healthy",
      feeds: cleanFeeds,
    });

    return res.status(201).json({ success: true, data: publisher });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function updatePublisher(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { name, homepageUrl, description, language, enabled, feeds } = req.body;

    const publisher = await Publisher.findById(id);
    if (!publisher) {
      return res.status(404).json({ success: false, error: "Publisher not found" });
    }

    if (name && typeof name === "string") {
      publisher.name = name.trim();
      publisher.slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    }
    if (typeof homepageUrl === "string") publisher.homepageUrl = homepageUrl.trim();
    if (typeof description === "string") publisher.description = description.trim();
    if (typeof language === "string") publisher.language = language.trim();
    if (typeof enabled === "boolean") publisher.enabled = enabled;

    if (Array.isArray(feeds)) {
      publisher.feeds = feeds.map((f: any) => ({
        url: f.url.trim(),
        name: f.name?.trim() || "Feed",
        category: f.category?.trim() || "General",
        enabled: f.enabled !== false,
        websubHub: f.websubHub || null,
        lastStatus: f.lastStatus || "pending",
        lastError: f.lastError || null,
      })) as any;
    }

    await publisher.save();
    return res.json({ success: true, data: publisher });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function togglePublisher(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const publisher = await Publisher.findById(id);
    if (!publisher) {
      return res.status(404).json({ success: false, error: "Publisher not found" });
    }
    publisher.enabled = !publisher.enabled;
    await publisher.save();
    return res.json({ success: true, data: publisher });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function deletePublisher(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const publisher = await Publisher.findByIdAndDelete(id);
    if (!publisher) {
      return res.status(404).json({ success: false, error: "Publisher not found" });
    }
    return res.json({ success: true, message: `Publisher '${publisher.name}' removed` });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function testFeedUrl(req: Request, res: Response) {
  try {
    const { url } = req.body;
    if (!url || typeof url !== "string" || !url.startsWith("http")) {
      return res.status(400).json({ success: false, error: "A valid http/https URL is required" });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url.trim(), {
      signal: controller.signal,
      headers: {
        "User-Agent": "Traceon-FeedValidator/1.0 (+https://github.com/kshailaja455/CapstoneProject)",
        Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9",
      },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return res.status(400).json({
        success: false,
        error: `Feed responded with HTTP ${response.status} ${response.statusText}`,
      });
    }

    const xml = await response.text();
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
    });

    const parsed = parser.parse(xml);
    const channel = parsed.rss?.channel || parsed.feed || parsed["rdf:RDF"];
    if (!channel) {
      return res.status(400).json({
        success: false,
        error: "URL responded with XML but no valid RSS or Atom feed structure was found",
      });
    }

    const feedTitle = channel.title || "Untitled Feed";
    const rawLanguage = channel.language || channel["@_xml:lang"] || "";
    const isLangCodeEn = isEnglishLanguageCode(rawLanguage);

    // Extract items / entries
    let rawItems = channel.item || channel.entry || [];
    if (!Array.isArray(rawItems)) {
      rawItems = [rawItems];
    }

    // Inspect first 3 items for English content
    const sampleArticles: any[] = [];
    let detectedEnglishCount = 0;

    for (let i = 0; i < Math.min(rawItems.length, 3); i++) {
      const item = rawItems[i];
      const title = item.title?.["#text"] || item.title || "";
      const link = typeof item.link === "object" ? item.link?.["@_href"] || "" : item.link || "";
      const desc = item.description || item.summary || item.content?.["#text"] || item.content || "";
      const pubDate = item.pubDate || item.published || item.updated || "";

      const detection = detectEnglish(`${title} ${desc}`);
      if (detection.isEnglish) detectedEnglishCount++;

      sampleArticles.push({
        title: typeof title === "string" ? title.slice(0, 150) : "Article",
        link: typeof link === "string" ? link : "",
        pubDate,
        isEnglish: detection.isEnglish,
        confidence: detection.confidence,
      });
    }

    const overallEnglish = isLangCodeEn || detectedEnglishCount >= Math.min(1, rawItems.length);

    // Check for WebSub hub in Atom links
    let websubHub: string | null = null;
    const links = Array.isArray(channel.link) ? channel.link : [channel.link];
    for (const l of links) {
      if (l?.["@_rel"] === "hub" && l?.["@_href"]) {
        websubHub = l["@_href"];
        break;
      }
    }

    return res.json({
      success: true,
      data: {
        valid: true,
        title: feedTitle,
        declaredLanguage: rawLanguage || "Not specified in XML",
        isEnglish: overallEnglish,
        entryCount: rawItems.length,
        websubHub,
        sampleArticles,
        summary: overallEnglish
          ? `Verified English feed: "${feedTitle}" with ${rawItems.length} article(s)`
          : `Warning: Feed does not appear to be primarily English. Only English articles will be accepted.`,
      },
    });
  } catch (error: any) {
    const msg = error.name === "AbortError" ? "Feed request timed out after 8 seconds" : error.message;
    return res.status(400).json({ success: false, error: msg });
  }
}

