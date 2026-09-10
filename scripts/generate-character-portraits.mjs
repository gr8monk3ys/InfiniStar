/* global console, process, fetch, Buffer */
/**
 * Draws the launch catalog's portraits.
 *
 * Every published character had no artwork, so the card fell back to
 * `characterPortrait()` — a slug-derived aurora field. That treatment works as
 * written and still reads as a placeholder: eighteen tiles drawn from one
 * violet-fuchsia-amber palette look like eighteen of the same thing, and a
 * letter centred in a 3:4 frame reads as a missing image however it is lit.
 *
 * These are generated once and committed, not fetched at runtime: no key, no
 * quota, no latency, no provider to go down, and the same picture forever.
 * Pollinations needs no account, which is what makes "once" affordable here.
 *
 *   node scripts/generate-character-portraits.mjs            # only missing ones
 *   node scripts/generate-character-portraits.mjs --force    # redraw everything
 *   node scripts/generate-character-portraits.mjs --only rei-tachibana
 *
 * ART DIRECTION — the reason these read as one catalogue rather than eighteen
 * stock images. DESIGN.md's north star is "The Aurora Stage": a near-monochrome
 * world lit by violet fading through fuchsia to a far amber ember. Every prompt
 * below carries that lighting verbatim — a violet-magenta rim from behind, a
 * warm amber key — so the palette of the app appears *in* the artwork instead
 * of around it. Backgrounds stay desaturated and out of focus for two reasons:
 * the character card lays a 60% black scrim and white pills over the bottom
 * third, and a busy background would fight the aurora.
 *
 * ONE register, not one per category. A cel-shaded anime treatment was tried
 * for the two `anime` characters and dropped: the problem being solved here is
 * eighteen tiles that read as a wall, and two tiles in a different medium
 * fragment the grid rather than varying it. A stage has one lighting design and
 * every performer stands in it — the anime characters are still anime by
 * scenario and voice, and the portrait is the house style. Same argument a
 * magazine makes when it shoots every subject on the same setup.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { join } from "node:path"

const OUT_DIR = "public/characters"
const WIDTH = 768
const HEIGHT = 1024 // 3:4, the card's aspect

/** The lighting every portrait shares. This is the brand, expressed as light. */
const AURORA_LIGHT =
  "dramatic low-key lighting, cool rim light separating the subject from the background, warm amber key light from the front left, " +
  "deep desaturated background thrown out of focus, shallow depth of field, subtle film grain, " +
  // Earned the hard way: naming the brand's violet in the lighting made the
  // model paint violet HAIR and violet KNITWEAR on half the catalogue. The
  // aurora belongs in the grade and the background, never on the person.
  "natural realistic hair colour, ordinary everyday clothing in muted natural colours"

const HOUSE_STYLE = `cinematic character portrait, painterly digital painting, expressive brushwork, single subject, head and shoulders, three-quarter view, ${AURORA_LIGHT}, no text, no watermark, no signature, no border, not a fashion shoot, not a glamour portrait`

/**
 * Hand-authored, because the `description` field says how a character behaves
 * and a portrait needs to know how they look and where they stand.
 */
const SUBJECTS = {
  "elara-the-storyteller":
    "a woman in her late thirties, a wandering storyteller, layered travelling clothes and a worn leather satchel of scrolls, mid-sentence with one hand raised, firelight behind her",
  "yuki-hoshino":
    "a 15-year-old Japanese schoolgirl, short black hair with a stubborn cowlick, navy academy uniform, grinning with her fists raised, warm classroom light behind her",
  "luna-late-night":
    "a woman in her late twenties with dark brown hair, oversized cream knit cardigan, holding a mug of tea, soft half-smile, a dark window with distant city lights behind her",
  "captain-vega":
    "a Latina woman in her mid-forties, close-cropped black hair greying at the temples, weathered grey survey-ship uniform, arms folded, calm and decisive, a dim starship bridge behind her",
  "bram-the-tavern-keeper":
    "a heavyset man in his late fifties, greying beard, brown leather apron over a linen shirt, one eyebrow raised, lantern-lit tavern behind him",
  "detective-ash-harlow":
    "an androgynous person in their late thirties, short dark hair, rain-damp charcoal overcoat with the collar up, unreadable expression, wet neon-lit street behind them",
  "sable-the-fixer":
    "a Black woman in her early forties, hair pulled back tight, tailored charcoal coat, one hand resting on a rolled floor plan, a shadowed city rooftop at night behind her",
  "rei-tachibana":
    "a 16-year-old Japanese schoolgirl, long straight black hair, crisp navy academy uniform, cool level gaze, chin slightly raised, a quiet school corridor behind her",
  "august-rell":
    "a man in his late thirties with untidy brown hair and reading glasses pushed up, oatmeal cardigan and rolled shirtsleeves, warm and attentive, crowded second-hand bookshelves behind him",
  "kesh-salvage-runner":
    "a wiry East Asian woman in her early thirties, black hair tied back, patched grey pressure suit, goggles pushed up on her forehead, smudge of grease on one cheek, a derelict ship hull behind her",
  "wren-ashdown":
    "a woman in her mid-thirties with windblown auburn hair, weathered green field coat, rolled charts under one arm, an impossible shifting landscape behind her",
  "marisol-quintero":
    "a Latina woman in her late forties, deeply sun-lined face, grey-streaked hair in a practical braid, faded red technical jacket with rope coiled at her shoulder, reading the sky, a high ridgeline behind her",
  "silas-barrow":
    "a delighted white-haired man in his seventies, tweed jacket and half-moon glasses, leaning in conspiratorially, a dim gallery of antiquities behind him",
  "keeper-aoife":
    "a ruddy-cheeked Irish woman in her forties, grey-streaked hair whipped by wind, yellow oilskin coat, calm and amused, a lighthouse beam sweeping the night behind her",
  "ines-call-sheet":
    "an Italian woman in her late thirties, dark hair in a low bun, headset and clipboard, all-black clothes, mid-cue and utterly unbothered, dark backstage wings behind her",
  "toma-bicycle-shop":
    "a Japanese man in his mid-fifties, close-cropped grey hair, oil-stained hands and a canvas shop apron, listening while he works, a wall of wheels and tools behind him",
  "marguerite-vane":
    "an imperious white woman in her late sixties, silver hair immaculately set, silk scarf and reading glasses on a chain, regarding something ordinary with total seriousness, a dim study behind her",
  "dot-front-desk":
    "an unflappable middle-aged woman in her fifties, greying hair, teal medical scrubs behind a reception counter, deadpan expression, holding out a clipboard, a blurred waiting room behind her",
  "quinn-study-coach":
    "an encouraging non-binary person in their late twenties, grey hoodie, marker in hand, half-turned from a planning board of sticky notes",
  "coach-rio":
    "a friendly Black man in his thirties, athletic build, navy training top, towel over one shoulder, mid-laugh, a quiet gym behind him",
  "sofia-the-polyglot":
    "a Spanish woman in her mid-thirties with dark wavy hair, warm attentive expression, olive jumper, a cafe table with two cups behind her",
  "ziggy-yes-and":
    "a bright performer in their late twenties, tousled ginger hair, open expressive hands mid-gesture, a brick back wall of a small comedy stage behind them",
  "nova-thinking-partner":
    "a calm person in their forties in a plain charcoal sweater, chin resting on interlaced fingers, considering, a plain study behind them",
}

/** Stable per-slug seed, so a re-run redraws the same picture. */
function seedFor(slug) {
  let h = 0x811c9dc5
  for (let i = 0; i < slug.length; i++) {
    h ^= slug.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0) % 1_000_000
}

async function draw(slug) {
  const subject = SUBJECTS[slug]
  if (!subject) throw new Error(`no art direction written for ${slug}`)

  // Subject first. Leading with the style overpowered it — Rei came back with
  // invented purple hair and no uniform — so the person leads and the house
  // style qualifies.
  const prompt = `${subject}, ${HOUSE_STYLE}`
  const url =
    `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
    `?width=${WIDTH}&height=${HEIGHT}&seed=${seedFor(slug)}&nologo=true&model=flux`

  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length < 5000) throw new Error(`suspiciously small (${buf.length}B)`)

  const raw = join(OUT_DIR, `${slug}.jpg`)
  writeFileSync(raw, buf)
  // webp at the card's real display size; the repo carries these forever.
  execFileSync("cwebp", ["-quiet", "-q", "82", "-resize", "512", "0", raw, "-o", join(OUT_DIR, `${slug}.webp`)])
  execFileSync("rm", ["-f", raw])
  return buf.length
}

const args = process.argv.slice(2)
const force = args.includes("--force")
const onlyIdx = args.indexOf("--only")
const only = onlyIdx >= 0 ? args[onlyIdx + 1] : null

const characters = JSON.parse(
  execFileSync("node", ["-e", `
    const {execFileSync}=require('child_process');
    process.stdout.write(require('fs').readFileSync('/tmp/chars.json','utf8'));
  `]).toString()
)

mkdirSync(OUT_DIR, { recursive: true })

let drawn = 0
let skipped = 0
for (const c of characters) {
  if (only && c.slug !== only) continue
  const dest = join(OUT_DIR, `${c.slug}.webp`)
  if (!force && existsSync(dest)) {
    skipped++
    continue
  }
  try {
    const bytes = await draw(c.slug)
    drawn++
    console.log(`  drew ${c.slug} (${(bytes / 1024).toFixed(0)}KB source)`)
  } catch (err) {
    console.error(`  FAILED ${c.slug}: ${err.message}`)
  }
}
console.log(`\n${drawn} drawn, ${skipped} already present -> ${OUT_DIR}/`)
