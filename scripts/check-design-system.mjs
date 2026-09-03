#!/usr/bin/env node
/* global console, process */
/**
 * check-design-system.mjs — make DESIGN.md fail the build the way TypeScript does.
 *
 * DESIGN.md documents named rules ("The One Voice Rule", "The One Gradient Phrase
 * Rule", ...). Prose does not fail CI, so the rules that are mechanically
 * checkable are checked here instead. Zero dependencies, plain Node, one pass
 * over app/**\/*.tsx.
 *
 *   node scripts/check-design-system.mjs          human-readable report
 *   node scripts/check-design-system.mjs --json   machine output
 *
 * Exit 0 when clean, 1 when any rule fires.
 */
import { readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const APP = join(ROOT, "app")
const MARKETING = join(APP, "(marketing)")

/* ------------------------------------------------------------------ policy */

/**
 * Tailwind palette families that are off-system. DESIGN.md → Do's and Don'ts:
 * "Don't hardcode gray-*, violet-*, sky-*, or blue-* utilities in new
 * components". Violet included on purpose: the brand violet ships as the
 * `--primary` token, never as `violet-600`.
 */
const PALETTE_FAMILIES = [
  "gray",
  "slate",
  "zinc",
  "neutral",
  "stone",
  "violet",
  "purple",
  "blue",
  "sky",
  "indigo",
  "pink",
  "fuchsia",
  "rose",
  "cyan",
  "teal",
]

/**
 * Deliberately NOT in PALETTE_FAMILIES. DESIGN.md → Colors → Semantic permits
 * status hues (the green live dot, red destructive/18+, amber warnings), so
 * these stay legal everywhere. Add or remove a family here to change policy.
 */
const SEMANTIC_FAMILIES = ["green", "emerald", "amber", "yellow", "orange", "red"]

const PALETTE_PREFIXES = "bg|text|border|from|to|via|ring|shadow|placeholder|divide|outline"

/**
 * Documented exemptions. One entry per exemption, one line saying WHY it is
 * data (or a sanctioned singleton) rather than styling. Changing what is
 * allowed is a one-line edit here — never a change to a rule's regex.
 *
 *   rule   which rule the exemption applies to
 *   file   repo-relative path
 *   block  optional: only inside this named declaration (`const NAME = ...`),
 *          so an off-system utility elsewhere in the same file still fails
 *   lines  optional: only these 1-based line numbers
 *   limit  optional: exempt at most this many hits, so "the one sanctioned
 *          hero pill" does not quietly become two
 */
const ALLOWLIST = [
  {
    rule: "palette",
    file: "app/(marketing)/characters/[slug]/page.tsx",
    block: "gradientMap",
    // Per-category portrait gradients keyed by character.category — color as DATA, not styling.
    why: "per-category portrait gradient map (color keyed by data, not a style choice)",
  },
  {
    rule: "palette",
    file: "app/components/ai-memory/MemoryManager.tsx",
    block: "CATEGORY_STYLES",
    // Memory categories (preference/fact/context/...) need distinguishable hues; the set is data.
    why: "memory-category color map (hue distinguishes a data category)",
  },
  {
    rule: "palette",
    file: "app/components/suggestions/SuggestionCard.tsx",
    block: "getTypeColors",
    // Suggestion types (reply/question/continue/...) are colour-coded data, same as above.
    why: "suggestion-type color map (hue distinguishes a data category)",
  },
  {
    rule: "palette",
    file: "app/components/tailwind-indicator.tsx",
    // Dev-only breakpoint badge; returns null in production, never ships to a user.
    why: "dev-only breakpoint indicator, returns null in production",
  },
  {
    rule: "gradient-phrase",
    file: "app/(marketing)/_components/HomeSections.tsx",
    block: "HowItWorksSection",
    // DESIGN.md → The One Gradient Phrase Rule exempts "the wordmark and step numerals".
    why: "how-it-works step numerals, exempted by name in the rule itself",
  },
  {
    rule: "sparkle-pill",
    file: "app/(marketing)/_components/HeroSection.tsx",
    block: "HeroSection",
    limit: 1,
    // DESIGN.md: "the hero eyebrow pill is the single sanctioned use".
    why: "the one sanctioned home-hero eyebrow pill",
  },
]

/**
 * Shared wordmark components. Gradient-clipped text is explicitly allowed on
 * the wordmark, and these render on every marketing page, so they never count
 * against a page's gradient-phrase budget.
 */
const WORDMARK_FILES = ["app/components/site-footer.tsx", "app/components/main-nav.tsx"]

/**
 * Rule 4 flags violet text at rest only. DESIGN.md → Character Card documents
 * the card name "turning violet on hover" at 0.875rem, so variant-prefixed
 * occurrences (`hover:text-primary`, `group-hover:text-primary`) are a
 * documented pattern, not a contrast bug. Flip to false to flag them too.
 */
const SMALL_VIOLET_TEXT_RESTING_ONLY = true

const RULES = {
  palette: {
    title: "Hardcoded Tailwind palette utilities",
    doc: "DESIGN.md → Do's and Don'ts → \"Don't hardcode gray-*, violet-*, sky-*, or blue-* utilities\" (see also Colors → Named Rules → The One Voice Rule). Route color through the semantic tokens.",
  },
  "gradient-phrase": {
    title: "More than one gradient-clipped phrase on a page",
    doc: "DESIGN.md → Typography → Named Rules → The One Gradient Phrase Rule.",
  },
  "sparkle-pill": {
    title: "Sparkle-icon eyebrow pill used as decoration",
    doc: "DESIGN.md → Do's and Don'ts → \"Don't add sparkle-icon pill badges as decoration; the hero eyebrow pill is the single sanctioned use.\"",
  },
  "small-violet-text": {
    title: "Small violet text on --primary instead of --primary-accent",
    doc: "DESIGN.md → Colors → Primary → Primary Accent: use `text-primary-accent` for any violet text under 16px; `--primary` measures 3.5:1 on the night canvas.",
  },
  "tiny-font": {
    title: "Literal font size below the 12px label step",
    doc: "DESIGN.md → Typography → Hierarchy → Label (0.75rem/12px is the floor; portrait overlays are Label size, never smaller).",
  },
}

/* ------------------------------------------------------------------- files */

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry.startsWith(".")) continue
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) walk(full, out)
    else if (entry.endsWith(".tsx")) out.push(full)
  }
  return out
}

const cache = new Map()
function read(absPath) {
  let hit = cache.get(absPath)
  if (!hit) {
    const text = readFileSync(absPath, "utf8")
    hit = { text, lines: text.split("\n") }
    cache.set(absPath, hit)
  }
  return hit
}

const rel = (absPath) => relative(ROOT, absPath)

/* --------------------------------------------------------------- allowlist */

/**
 * Line range [start, end] of `const NAME = ...` / `function NAME(...)`, found by
 * bracket matching. For a `const` the count starts at the `=` so a multi-line
 * type annotation (`const X: Record<\n A,\n {...}\n> = {`) does not close the
 * block early; for a `function` it starts at the declaration line, so the
 * parameter list and any return-type object balance out.
 */
function blockRange(lines, name) {
  const head = new RegExp(
    `^\\s*(?:export\\s+)?(?:async\\s+)?(?:const|let|var|function)\\s+${name}\\b`
  )
  const start = lines.findIndex((line) => head.test(line))
  if (start === -1) return null
  const isBinding = /^\s*(?:export\s+)?(?:const|let|var)\b/.test(lines[start])

  let depth = 0
  let counting = !isBinding
  for (let i = start; i < lines.length; i++) {
    const line = lines[i]
    for (let c = 0; c < line.length; c++) {
      const ch = line[c]
      if (!counting) {
        // First assignment `=` (not `=>`, `==`, `>=`, `<=`, `!=`) starts the body.
        if (
          ch === "=" &&
          !"=><!".includes(line[c + 1] ?? "") &&
          !"=><!".includes(line[c - 1] ?? "")
        )
          counting = true
        continue
      }
      if (ch === "{" || ch === "(" || ch === "[") depth++
      else if (ch === "}" || ch === ")" || ch === "]") depth--
    }
    if (counting && depth <= 0 && i > start) return [start + 1, i + 1]
    if (counting && depth <= 0 && i === start && /[)}\]]/.test(line)) return [start + 1, i + 1]
  }
  return [start + 1, lines.length]
}

const rangeCache = new Map()
const used = new Map()

function take(entry) {
  const count = (used.get(entry) ?? 0) + 1
  used.set(entry, count)
  if (entry.limit === undefined) return entry
  return count <= entry.limit ? entry : null
}

function isAllowed(rule, file, line, lines) {
  for (const entry of ALLOWLIST) {
    if (entry.rule !== rule || entry.file !== file) continue
    if (entry.lines) {
      if (entry.lines.includes(line)) return take(entry)
      continue
    }
    if (entry.block) {
      const key = `${file}::${entry.block}`
      if (!rangeCache.has(key)) rangeCache.set(key, blockRange(lines, entry.block))
      const range = rangeCache.get(key)
      if (range && line >= range[0] && line <= range[1]) return take(entry)
      continue
    }
    return take(entry)
  }
  return null
}

/* ------------------------------------------------------------------- utils */

function* matchLines(lines, regex) {
  for (let i = 0; i < lines.length; i++) {
    regex.lastIndex = 0
    let m
    while ((m = regex.exec(lines[i])) !== null) {
      yield { line: i + 1, match: m[0], text: lines[i] }
      if (m[0] === "") regex.lastIndex++
    }
  }
}

const snippet = (text) => text.trim().replace(/\s+/g, " ").slice(0, 118)

/**
 * The files a marketing page actually renders: the page itself plus every
 * component it pulls in by relative import, transitively, while the import
 * stays inside app/(marketing). Counting per page.tsx alone would miss the
 * hero and CTA sections, which live in `_components/`.
 */
function pageGraph(pageFile) {
  const seen = new Set()
  const queue = [pageFile]
  while (queue.length) {
    const current = queue.shift()
    if (seen.has(current)) continue
    seen.add(current)
    const { text } = read(current)
    const importRe = /from\s+"(\.[^"]+)"/g
    let m
    while ((m = importRe.exec(text)) !== null) {
      const base = resolve(dirname(current), m[1])
      for (const candidate of [`${base}.tsx`, join(base, "index.tsx")]) {
        if (!candidate.startsWith(MARKETING)) continue
        try {
          if (statSync(candidate).isFile()) queue.push(candidate)
        } catch {
          /* not a tsx module — ignore */
        }
      }
    }
  }
  return [...seen]
}

/**
 * Full value of every `className=` attribute, including multi-line `cn(...)`
 * calls, so "in the same className string" means what it says.
 */
function classNameAttrs(text) {
  const out = []
  const re = /className=/g
  let m
  while ((m = re.exec(text)) !== null) {
    let i = m.index + m[0].length
    const line = text.slice(0, m.index).split("\n").length
    if (text[i] === '"' || text[i] === "'" || text[i] === "`") {
      const quote = text[i]
      const end = text.indexOf(quote, i + 1)
      if (end === -1) continue
      out.push({ line, value: text.slice(i + 1, end) })
      re.lastIndex = end
    } else if (text[i] === "{") {
      let depth = 0
      const start = i
      for (; i < text.length; i++) {
        if (text[i] === "{") depth++
        else if (text[i] === "}" && --depth === 0) break
      }
      out.push({ line, value: text.slice(start + 1, i) })
      re.lastIndex = i
    }
  }
  return out
}

/* ------------------------------------------------------------------- rules */

const violations = []
function report(rule, file, line, text) {
  violations.push({ rule, file, line, snippet: snippet(text) })
}

const appFiles = walk(APP)

// Rule 1 — no hardcoded palette utilities outside app/globals.css.
{
  const re = new RegExp(
    `\\b(?:${PALETTE_PREFIXES})-(?:${PALETTE_FAMILIES.join("|")})-[0-9]{2,3}\\b`,
    "g"
  )
  for (const abs of appFiles) {
    const file = rel(abs)
    const { lines } = read(abs)
    for (const hit of matchLines(lines, re)) {
      if (isAllowed("palette", file, hit.line, lines)) continue
      report("palette", file, hit.line, `${hit.match}  —  ${hit.text}`)
    }
  }
}

// Rules 2 + 3 operate on what a marketing page actually renders.
const marketingPages = appFiles
  .filter((f) => f.startsWith(MARKETING) && /(^|\/)page\.tsx$/.test(f))
  .sort()

// Rule 2 — The One Gradient Phrase Rule.
for (const page of marketingPages) {
  const hits = []
  for (const abs of pageGraph(page)) {
    const file = rel(abs)
    if (WORDMARK_FILES.includes(file)) continue
    const { lines } = read(abs)
    for (const hit of matchLines(lines, /gradient-text/g)) {
      if (isAllowed("gradient-phrase", file, hit.line, lines)) continue
      hits.push({ file, line: hit.line, text: hit.text })
    }
  }
  if (hits.length > 1) {
    for (const hit of hits) {
      report(
        "gradient-phrase",
        hit.file,
        hit.line,
        `${hits.length} gradient phrases on ${rel(page)}  —  ${hit.text}`
      )
    }
  }
}

// Rule 3 — sparkle-icon eyebrow pills as decoration.
{
  const SPARKLE = /<(?:HiOutlineSparkles|HiSparkles|Sparkles|SparklesIcon)\b/g
  const LOOKBACK = 8
  const seen = new Set()
  for (const page of marketingPages) {
    for (const abs of pageGraph(page)) {
      const file = rel(abs)
      const { lines } = read(abs)
      for (const hit of matchLines(lines, SPARKLE)) {
        const key = `${file}:${hit.line}`
        if (seen.has(key)) continue
        const from = Math.max(0, hit.line - 1 - LOOKBACK)
        const container = lines
          .slice(from, hit.line - 1)
          .reverse()
          .find((l) => /className=/.test(l) && /\brounded-full\b/.test(l) && /\bborder\b/.test(l))
        if (!container) continue
        seen.add(key)
        if (isAllowed("sparkle-pill", file, hit.line, lines)) continue
        report("sparkle-pill", file, hit.line, `${hit.text.trim()}  ←  in ${snippet(container)}`)
      }
    }
  }
}

// Rule 4 — small violet text must use the text-safe token.
{
  const SMALL = /\btext-(?:xs|sm)\b/
  const PRIMARY = SMALL_VIOLET_TEXT_RESTING_ONLY
    ? /(?<![-\w:])text-primary(?![-\w/])/
    : /(?<![-\w])text-primary(?![-\w/])/
  for (const abs of appFiles) {
    const file = rel(abs)
    const { text, lines } = read(abs)
    if (!text.includes("text-primary")) continue
    for (const attr of classNameAttrs(text)) {
      if (!SMALL.test(attr.value) || !PRIMARY.test(attr.value)) continue
      if (isAllowed("small-violet-text", file, attr.line, lines)) continue
      report("small-violet-text", file, attr.line, snippet(attr.value))
    }
  }
}

// Rule 5 — literal font sizes below the 12px label step.
{
  const re = /text-\[([0-9]+(?:\.[0-9]+)?)px\]/g
  for (const abs of appFiles) {
    const file = rel(abs)
    const { lines } = read(abs)
    for (const hit of matchLines(lines, re)) {
      const px = Number(hit.match.match(/([0-9.]+)px/)[1])
      if (px >= 12) continue
      if (isAllowed("tiny-font", file, hit.line, lines)) continue
      report("tiny-font", file, hit.line, `${hit.match}  —  ${hit.text}`)
    }
  }
}

/* ------------------------------------------------------------------ output */

const order = Object.keys(RULES)
violations.sort(
  (a, b) =>
    order.indexOf(a.rule) - order.indexOf(b.rule) || a.file.localeCompare(b.file) || a.line - b.line
)

if (process.argv.includes("--json")) {
  const byRule = Object.fromEntries(
    order.map((r) => [r, violations.filter((v) => v.rule === r).length])
  )
  process.stdout.write(
    `${JSON.stringify(
      {
        ok: violations.length === 0,
        filesScanned: appFiles.length,
        total: violations.length,
        byRule,
        violations,
        allowlist: ALLOWLIST.map((entry) => ({
          rule: entry.rule,
          file: entry.file,
          block: entry.block,
          lines: entry.lines,
          limit: entry.limit,
          why: entry.why,
          applied: used.get(entry) ?? 0,
        })),
      },
      null,
      2
    )}\n`
  )
  process.exit(violations.length === 0 ? 0 : 1)
}

if (violations.length === 0) {
  console.log(`design-system: OK — ${appFiles.length} .tsx files, 0 violations`)
  process.exit(0)
}

console.log("")
console.log(`design-system: ${violations.length} violation(s) across ${appFiles.length} .tsx files`)
for (const rule of order) {
  const hits = violations.filter((v) => v.rule === rule)
  if (hits.length === 0) continue
  console.log("")
  console.log(`── ${RULES[rule].title}  (${hits.length})`)
  for (const hit of hits) console.log(`   ${hit.file}:${hit.line}  ${hit.snippet}`)
  console.log(`   → ${RULES[rule].doc}`)
}
console.log("")
console.log("Summary:")
for (const rule of order) {
  const count = violations.filter((v) => v.rule === rule).length
  console.log(`   ${String(count).padStart(3)}  ${rule}`)
}
console.log(`   ${String(violations.length).padStart(3)}  total`)
console.log("")
console.log(
  `Genuine data (category color maps, dev-only tools) belongs in ALLOWLIST at the top of ${rel(
    fileURLToPath(import.meta.url)
  )} — one entry, one reason. Semantic status hues (${SEMANTIC_FAMILIES.join(", ")}) are permitted and never flagged.`
)
process.exit(1)
