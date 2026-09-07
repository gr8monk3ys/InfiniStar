import { moderateTextWithOpenAi } from "@/app/lib/model-moderation"

export type ModerationCategory =
  | "harassment"
  | "hate"
  | "sexual"
  | "violence"
  | "self_harm"
  | "spam"
  | "scam"

export type ModerationSeverity = "safe" | "review" | "block"

/**
 * How to moderate content, given who wrote it.
 *
 * `mature` is for an account that has confirmed adulthood *and* opted in, in a
 * conversation with a mature Character. It suppresses the consenting-adults
 * *review* signal — and only that.
 *
 * It does not touch BLOCK_RULES. `child sexual abuse`, `rape fantasy` and
 * `sexual assault fantasy` block under every posture, as does everything in the
 * hate, violence, self-harm and scam families. Nor does it touch the model
 * moderator's block escalation: `minors`, `threatening`, `graphic` and
 * `instructions` still block. The age gate permits adults to write explicit
 * fiction with each other; it permits nothing else, and this type is not a way
 * to widen that.
 */
export type ModerationPosture = "standard" | "mature"

/**
 * Review categories that a mature posture suppresses.
 *
 * Only `sexual`. A mature conversation is not a licence for harassment, hate,
 * threats or self-harm content, so those keep flagging for review regardless.
 */
const MATURE_SUPPRESSED_REVIEW_CATEGORIES: ReadonlySet<ModerationCategory> = new Set(["sexual"])

const SAFE_RESULT: ModerationResult = {
  severity: "safe",
  shouldBlock: false,
  shouldReview: false,
  categories: [],
  matches: [],
}

export interface ModerationMatch {
  category: ModerationCategory
  label: string
}

export interface ModerationResult {
  severity: ModerationSeverity
  shouldBlock: boolean
  shouldReview: boolean
  categories: ModerationCategory[]
  matches: ModerationMatch[]
}

interface ModerationRule {
  category: ModerationCategory
  label: string
  pattern: RegExp
}

const BLOCK_RULES: ModerationRule[] = [
  {
    category: "harassment",
    label: "self-harm encouragement",
    pattern: /\b(kys|kill yourself|go die)\b/i,
  },
  {
    category: "hate",
    label: "extremist hate phrase",
    pattern: /\b(white power|ethnic cleansing|genocide supporters?)\b/i,
  },
  {
    category: "sexual",
    label: "sexual exploitation phrase",
    pattern: /\b(child sexual abuse|sexual assault fantasy|rape fantasy)\b/i,
  },
  {
    category: "violence",
    label: "weapon construction request",
    pattern: /\b(make a bomb|build a bomb|mass shooting plan)\b/i,
  },
  {
    category: "self_harm",
    label: "self-harm method request",
    pattern: /\b(best way to self[- ]harm|how to kill myself)\b/i,
  },
  {
    category: "scam",
    label: "financial fraud phrase",
    pattern: /\b(stolen credit card|carding tutorial|phishing kit)\b/i,
  },
]

const REVIEW_RULES: ModerationRule[] = [
  {
    category: "harassment",
    label: "targeted abuse phrase",
    pattern: /\b(you are worthless|you are trash|nobody wants you)\b/i,
  },
  {
    category: "hate",
    label: "targeted hate phrase",
    pattern: /\b(i hate (immigrants|muslims|christians|jews|women|men))\b/i,
  },
  {
    category: "sexual",
    label: "adult sexual phrase",
    pattern: /\b(nsfw|explicit sex|nude roleplay|porn)\b/i,
  },
  {
    category: "violence",
    label: "violent action phrase",
    pattern: /\b(murder|shoot them|stab them|execute)\b/i,
  },
  {
    category: "self_harm",
    label: "self-harm ideation phrase",
    pattern: /\b(i want to hurt myself|i want to die)\b/i,
  },
  {
    category: "spam",
    label: "promotional spam phrase",
    pattern: /\b(buy now|guaranteed profit|limited time offer|click this link)\b/i,
  },
  {
    category: "scam",
    label: "fraud phrase",
    pattern: /\b(crypto doubling|wire money first|advance fee)\b/i,
  },
]

function collectMatches(content: string, rules: ModerationRule[]): ModerationMatch[] {
  return rules
    .filter((rule) => rule.pattern.test(content))
    .map((rule) => ({
      category: rule.category,
      label: rule.label,
    }))
}

export function moderateText(
  content: string | null | undefined,
  posture: ModerationPosture = "standard"
): ModerationResult {
  if (!content || content.trim().length === 0) {
    return { ...SAFE_RESULT }
  }

  const normalized = content.trim()
  const blockedMatches = collectMatches(normalized, BLOCK_RULES)
  if (blockedMatches.length > 0) {
    const categories = [...new Set(blockedMatches.map((match) => match.category))]
    return {
      severity: "block",
      shouldBlock: true,
      shouldReview: false,
      categories,
      matches: blockedMatches,
    }
  }

  const reviewMatches = applyPosture(collectMatches(normalized, REVIEW_RULES), posture)
  if (reviewMatches.length > 0) {
    const categories = [...new Set(reviewMatches.map((match) => match.category))]
    return {
      severity: "review",
      shouldBlock: false,
      shouldReview: true,
      categories,
      matches: reviewMatches,
    }
  }

  return { ...SAFE_RESULT }
}

/**
 * Drops the review signals a mature posture consents to. Applied to review
 * matches only — the caller has already returned for anything that blocks.
 */
function applyPosture(matches: ModerationMatch[], posture: ModerationPosture): ModerationMatch[] {
  if (posture !== "mature") {
    return matches
  }
  return matches.filter((match) => !MATURE_SUPPRESSED_REVIEW_CATEGORIES.has(match.category))
}

export function moderationReasonFromCategories(
  categories: ModerationCategory[]
): "HARASSMENT" | "HATE" | "SEXUAL" | "VIOLENCE" | "SPAM" | "COPYRIGHT" | "OTHER" {
  if (categories.includes("hate")) {
    return "HATE"
  }
  if (categories.includes("sexual")) {
    return "SEXUAL"
  }
  if (categories.includes("violence")) {
    return "VIOLENCE"
  }
  if (categories.includes("spam") || categories.includes("scam")) {
    return "SPAM"
  }
  if (categories.includes("harassment")) {
    return "HARASSMENT"
  }
  return "OTHER"
}

export function buildModerationDetails(result: ModerationResult, context: string): string {
  const categoryList = result.categories.join(", ")
  const labels = result.matches
    .map((match) => match.label)
    .slice(0, 6)
    .join(", ")
  return `Auto-flagged in ${context}. Categories: ${categoryList}. Signals: ${labels}.`
}

function severityRank(severity: ModerationSeverity): number {
  switch (severity) {
    case "block":
      return 2
    case "review":
      return 1
    default:
      return 0
  }
}

function mergeModerationResults(a: ModerationResult, b: ModerationResult): ModerationResult {
  const severity = severityRank(a.severity) >= severityRank(b.severity) ? a.severity : b.severity
  const categories = [...new Set([...a.categories, ...b.categories])]
  const matches = [...a.matches, ...b.matches].filter(
    (match, idx, all) =>
      all.findIndex((m) => m.category === match.category && m.label === match.label) === idx
  )

  return {
    severity,
    shouldBlock: severity === "block",
    shouldReview: severity === "review",
    categories,
    matches,
  }
}

export async function moderateTextModelAssisted(
  content: string | null | undefined,
  posture: ModerationPosture = "standard"
): Promise<ModerationResult> {
  const baseline = moderateText(content, posture)
  if (!content || content.trim().length === 0) {
    return baseline
  }

  try {
    const modelResult = await moderateTextWithOpenAi(content.trim())
    if (!modelResult) {
      return baseline
    }
    // The model moderator escalates minors/threatening/graphic/instructions to
    // `block`; everything else it flags arrives as `review`. A mature posture
    // consents to the sexual half of that, and to nothing that blocks.
    const postured =
      modelResult.severity === "review"
        ? withMatches(modelResult, applyPosture(modelResult.matches, posture))
        : modelResult

    return mergeModerationResults(baseline, postured)
  } catch {
    return baseline
  }
}

/** Rebuilds a result around a filtered match list, recomputing its severity. */
function withMatches(result: ModerationResult, matches: ModerationMatch[]): ModerationResult {
  if (matches.length === 0) {
    return { ...SAFE_RESULT }
  }
  return {
    ...result,
    categories: [...new Set(matches.map((match) => match.category))],
    matches,
  }
}
