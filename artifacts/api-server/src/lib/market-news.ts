import {
  MARKET_SIGNAL_TYPES,
  MARKET_RISK_LEVELS,
  APPROVAL_ROUTES,
} from "@workspace/db";

type MarketSignalType = (typeof MARKET_SIGNAL_TYPES)[number];
type MarketRiskLevel = (typeof MARKET_RISK_LEVELS)[number];
type ApprovalRoute = (typeof APPROVAL_ROUTES)[number];

/**
 * Live market-signal monitoring backed by Google News RSS.
 *
 * Google News RSS is free, keyless, and supports per-query search, which makes
 * it a good fit for pulling recent articles about each watched competitor /
 * keyword. We fetch per term, dedupe by article id, and classify each headline
 * heuristically (no AI/API key) into the market-signal schema.
 *
 * The feed is small, well-formed XML, so we extract items with focused regexes
 * rather than pulling in an XML-parser dependency.
 */

export interface RawArticle {
  externalId: string;
  title: string;
  url: string;
  sourceName: string;
  publishedAt: Date | null;
  matchedTerm: string;
}

const GOOGLE_NEWS = "https://news.google.com/rss/search";

/** Build a Google News RSS search URL for a single term. */
function feedUrl(term: string): string {
  // Recent, US/English results. Quotes removed so multi-word terms aren't
  // over-constrained (exact-phrase search returns very few items).
  const q = encodeURIComponent(`${term} when:14d`);
  return `${GOOGLE_NEWS}?q=${q}&hl=en-US&gl=US&ceid=US:en`;
}

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

function pick(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return m ? decodeEntities(m[1]) : "";
}

/** Fetch and parse recent articles for a single watched term. */
export async function fetchArticlesForTerm(term: string, limit = 8): Promise<RawArticle[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(feedUrl(term), {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; CollabOS-MarketPulse/1.0)" },
      signal: controller.signal,
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const blocks = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];
    return blocks.slice(0, limit).map((block): RawArticle => {
      const rawTitle = pick(block, "title");
      // Google appends " - Source" to titles; split it off for a clean source.
      const dashIdx = rawTitle.lastIndexOf(" - ");
      const title = dashIdx > 0 ? rawTitle.slice(0, dashIdx) : rawTitle;
      const source = pick(block, "source") || (dashIdx > 0 ? rawTitle.slice(dashIdx + 3) : "News");
      const url = pick(block, "link");
      const externalId = pick(block, "guid") || url;
      const pubRaw = pick(block, "pubDate");
      const pub = pubRaw ? new Date(pubRaw) : null;
      return {
        externalId,
        title,
        url,
        sourceName: source,
        publishedAt: pub && !Number.isNaN(pub.getTime()) ? pub : null,
        matchedTerm: term,
      };
    }).filter((a) => a.title && a.url);
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

/** Fetch articles across many terms in parallel, deduped by externalId. */
export async function fetchArticlesForTerms(terms: string[], perTerm = 8): Promise<RawArticle[]> {
  const cleaned = [...new Set(terms.map((t) => t.trim()).filter(Boolean))];
  if (cleaned.length === 0) return [];
  const batches = await Promise.all(cleaned.map((t) => fetchArticlesForTerm(t, perTerm)));
  const seen = new Set<string>();
  const out: RawArticle[] = [];
  for (const batch of batches) {
    for (const a of batch) {
      if (seen.has(a.externalId)) continue;
      seen.add(a.externalId);
      out.push(a);
    }
  }
  return out;
}

// --- Heuristic classification (keyword-based, no AI) --------------------------

interface Classification {
  signalType: MarketSignalType;
  risk: MarketRiskLevel;
  opportunity: string;
  recommendedResponse: string;
  reviewOwner: ApprovalRoute;
}

const RULES: Array<{
  test: RegExp;
  signalType: MarketSignalType;
  risk: MarketRiskLevel;
  opportunity: string;
  recommendedResponse: string;
}> = [
  {
    test: /price|pricing|discount|fee|cost|subscription|plan\b/i,
    signalType: "pricing",
    risk: "high",
    opportunity: "Pricing move in the market — chance to reassess our packaging and value story.",
    recommendedResponse: "Compare against our pricing tiers and decide whether to respond.",
  },
  {
    test: /launch|announc|releas|unveil|introduc|new (product|feature|tool|platform)/i,
    signalType: "new-product",
    risk: "medium",
    opportunity: "A new offering landed — evaluate overlap and differentiation vs. our roadmap.",
    recommendedResponse: "Review feature overlap and note gaps for the product roadmap.",
  },
  {
    test: /hir|job|recruit|talent|layoff|headcount/i,
    signalType: "job-posting",
    risk: "low",
    opportunity: "Hiring signal hints at where a competitor is investing.",
    recommendedResponse: "Note the hiring focus as a directional signal; no immediate action.",
  },
  {
    test: /regulat|complianc|licens|law|rule|legislat|permit|bill|statute/i,
    signalType: "compliance-opportunity",
    risk: "high",
    opportunity: "Regulatory shift — a wedge for our compliance positioning.",
    recommendedResponse: "Assess how this rule affects clients and whether it opens a campaign.",
  },
  {
    test: /partner|acqui|merg|invest|funding|raise|deal\b/i,
    signalType: "positioning",
    risk: "medium",
    opportunity: "Market consolidation/partnership — watch for shifts in the competitive map.",
    recommendedResponse: "Track the relationship and reassess positioning if it matures.",
  },
  {
    test: /\bAI\b|automation|technology|software|digital|platform|integration/i,
    signalType: "tech-shift",
    risk: "medium",
    opportunity: "Technology shift worth tracking for our product direction.",
    recommendedResponse: "Evaluate relevance to our stack and note for the roadmap.",
  },
];

export function classifyArticle(title: string): Classification {
  for (const rule of RULES) {
    if (rule.test.test(title)) {
      return {
        signalType: rule.signalType,
        risk: rule.risk,
        opportunity: rule.opportunity,
        recommendedResponse: rule.recommendedResponse,
        // High-risk signals default to dual sign-off; others to Rose.
        reviewOwner: rule.risk === "high" ? "both" : "rose",
      };
    }
  }
  return {
    signalType: "trend",
    risk: "low",
    opportunity: "General market movement to stay aware of.",
    recommendedResponse: "Skim for relevance; no action needed unless it recurs.",
    reviewOwner: "rose",
  };
}
