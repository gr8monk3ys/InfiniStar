---
name: InfiniStar
description: Characters worth coming back to. A dark-or-light stage, an aurora of violet light, and the chat bubble as the star.
colors:
  nebula-violet: "hsl(263 70% 58%)"
  nebula-violet-dark: "hsl(263 70% 62%)"
  aurora-fuchsia: "hsl(316 72% 58%)"
  ember-pink: "hsl(349 89% 66%)"
  solar-amber: "hsl(32 95% 58%)"
  gradient-cta-start: "hsl(263 70% 50%)"
  gradient-cta-end: "hsl(349 80% 46%)"
  primary-accent: "hsl(263 70% 42%)"
  primary-accent-dark: "hsl(263 70% 76%)"
  paper: "hsl(0 0% 100%)"
  ink: "hsl(240 10% 3.9%)"
  mist: "hsl(240 4.8% 95.9%)"
  mist-2: "hsl(240 5.9% 90%)"
  mist-3: "hsl(240 3.7% 84%)"
  graphite: "hsl(240 3.8% 46.1%)"
  hairline: "hsl(240 5.9% 90%)"
  night: "hsl(240 6% 4%)"
  night-card: "hsl(240 4% 6%)"
  night-1: "hsl(240 4% 8%)"
  night-2: "hsl(240 4% 11%)"
  night-3: "hsl(240 3% 15%)"
  night-hairline: "hsl(240 4% 16%)"
  moon: "hsl(0 0% 95%)"
  moon-muted: "hsl(240 5% 55%)"
  signal-red: "hsl(0 84.2% 60.2%)"
typography:
  display:
    fontFamily: "Bricolage Grotesque, ui-sans-serif, system-ui, Segoe UI, Arial, sans-serif"
    fontSize: "clamp(3rem, 6vw, 4.5rem)"
    fontWeight: 800
    lineHeight: 0.98
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Bricolage Grotesque, ui-sans-serif, system-ui, Segoe UI, Arial, sans-serif"
    fontSize: "clamp(1.875rem, 3vw, 2.25rem)"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Bricolage Grotesque, ui-sans-serif, system-ui, Segoe UI, Arial, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, Segoe UI, Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.625
  body-large:
    fontFamily: "Inter, ui-sans-serif, system-ui, Segoe UI, Arial, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.625
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, Segoe UI, Arial, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
rounded:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "0.625rem"
  lg: "0.75rem"
  xl: "1rem"
  2xl: "1.5rem"
  3xl: "2.5rem"
  pill: "9999px"
spacing:
  1: "4px"
  2: "8px"
  3: "12px"
  4: "16px"
  6: "24px"
  7: "28px"
  8: "32px"
  12: "48px"
  16: "64px"
  24: "96px"
components:
  button-primary:
    backgroundColor: "{colors.nebula-violet}"
    textColor: "{colors.paper}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "hsl(263 70% 58% / 0.9)"
    textColor: "{colors.paper}"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
    height: "40px"
  button-outline-hover:
    backgroundColor: "{colors.mist}"
    textColor: "{colors.ink}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
    height: "40px"
  button-ghost-hover:
    backgroundColor: "{colors.mist}"
  button-hero:
    backgroundColor: "linear-gradient(120deg, {colors.gradient-cta-start}, hsl(316 72% 46%) 55%, {colors.gradient-cta-end})"
    textColor: "{colors.paper}"
    rounded: "{rounded.lg}"
    padding: "0 24px"
    height: "48px"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
    height: "40px"
  card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "24px"
  card-feature:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.2xl}"
    padding: "28px"
  chip:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.graphite}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
  badge:
    backgroundColor: "{colors.nebula-violet}"
    textColor: "{colors.paper}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "2px 10px"
  chat-bubble-user:
    backgroundColor: "{colors.nebula-violet}"
    textColor: "{colors.paper}"
    typography: "{typography.body}"
    rounded: "{rounded.xl}"
    padding: "10px 16px"
  chat-bubble-ai:
    backgroundColor: "{colors.mist}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.xl}"
    padding: "10px 16px"
---

# Design System: InfiniStar

## Overview

**Creative North Star: "The Aurora Stage"**

InfiniStar is a theater for characters. The canvas is quiet and nearly monochrome, white paper by day and near-black night by default in the dark theme, so that the only saturated thing on screen is the light the characters stand in. That light is an aurora: Nebula Violet fading through Aurora Fuchsia into Ember Pink, with a faint Solar Amber warmth at the far edge. It appears as a soft radial backdrop behind hero and call-to-action sections, as a gradient fill on the brand mark and the one hero button, and as gradient-clipped text on the single phrase in a headline that matters most. Everywhere else the palette is neutral, and the aurora is felt only as a violet tint on a hover border or a focus ring.

The performer on this stage is the chat bubble. Even the marketing pages sell the product by showing a conversation, not a screenshot: a frosted-glass card, a character header, an AI bubble on the left with a small cut top-left corner, a user bubble in Nebula Violet on the right with a cut top-right corner, and a three-dot typing indicator. Density is relaxed and mobile-first. Bricolage Grotesque gives headings a confident, slightly quirky voice; Inter keeps everything readable at small sizes for long reading and typing sessions on a phone.

The system rejects generic-AI clutter it once had. Product surfaces (dashboard, cards, forms) are flat and quiet; glow belongs to hero objects and to hover, never to layout.

**Key Characteristics:**

- Neutral zinc canvas in both themes; saturation reserved for the aurora and the primary action
- One violet family (263°) as primary, ring, user bubble, and brand gradient start
- Aurora backdrop + film grain + dot grid as the marketing stage; never on product screens
- Chat bubble as the signature object, with asymmetric corners that show who is speaking
- Bricolage Grotesque display type at tight tracking; Inter body at generous leading
- Frosted-glass header and cards (80% background, 20px blur) as the one material with depth
- Pill chips and badges; 0.75rem radius for controls; 1.5rem to 2.5rem for marketing panels

## Colors

A near-monochrome zinc canvas, lit by a violet-to-pink aurora with one amber ember.

### Primary

- **Nebula Violet** (`hsl(263 70% 58%)`, dark theme lifts the gradient start to `hsl(263 70% 62%)`): the product's one saturated voice. Primary buttons, the user's chat bubble, focus rings, active links, and the first stop of every brand gradient. Stays at the same value in dark mode so buttons remain identical across themes; white text on it clears WCAG AA.
- **Primary Accent** (`hsl(263 70% 42%)` light, `hsl(263 70% 76%)` dark, token `--primary-accent`, utility `text-primary-accent`): violet as _small text_. `--primary` keeps one lightness across themes so solid buttons match, which leaves violet body copy at 3.5:1 on the night canvas. Use this token for eyebrows, uppercase labels, links and any violet text under 16px. Measured 7.9:1 light and 7.7:1 dark on the home hero.
- **Aurora Fuchsia** (`hsl(316 72% 58%)`): middle stop of the brand gradient at 55%, and the second aurora glow. Never used as a solid fill on its own.
- **Ember Pink** (`hsl(349 89% 66%)`): the warm end of the brand gradient. Exists only inside gradients.
- **Solar Amber** (`hsl(32 95% 58%)`): the faintest aurora glow (10% alpha) placed low and to the right on marketing heroes. It is the one warm note and should never exceed that alpha.
- **CTA Gradient** (`hsl(263 70% 50%)` → `hsl(316 72% 46%)` at 55% → `hsl(349 80% 46%)`, `.gradient-bg-cta`): the brand gradient pulled down so white text clears WCAG AA at every stop. Measured white contrast in the browser: 7.2:1 at the violet start, 5.0:1 at the fuchsia middle, 5.3:1 at the pink end. The display gradient above (ending at Ember Pink `349 89% 66%`) measures only 3.2:1 against white, so it is reserved for surfaces that carry no text: avatars, the logo mark, gradient-clipped headings. Every button-shaped gradient surface uses the CTA stops, in both themes.

### Neutral (light theme)

- **Paper** (`hsl(0 0% 100%)`): page, card, and popover background.
- **Ink** (`hsl(240 10% 3.9%)`): body text and headings. A cool near-black, not pure black.
- **Graphite** (`hsl(240 3.8% 46.1%)`): secondary text, descriptions, nav links at rest, captions.
- **Mist** (`hsl(240 4.8% 95.9%)`), **Mist 2** (`hsl(240 5.9% 90%)`), **Mist 3** (`hsl(240 3.7% 84%)`): three tonal surface layers. Mist is also the AI chat bubble, the secondary button, and the hover fill for ghost buttons. Mist 2 doubles as the hairline border and input stroke.

### Neutral (dark theme)

- **Night** (`hsl(240 6% 4%)`): page background. **Night Card** (`hsl(240 4% 6%)`): cards and popovers. **Night 1/2/3** (`8% / 11% / 15%`): the surface layers, with Night 1 as the AI bubble and secondary fill.
- **Moon** (`hsl(0 0% 95%)`): text. **Moon Muted** (`hsl(240 5% 55%)`): secondary text. **Night Hairline** (`hsl(240 4% 16%)`): borders and input strokes.

### Semantic

- **Signal Red** (`hsl(0 84.2% 60.2%)`, dark `hsl(0 62.8% 30.6%)`): destructive buttons and badges only. The 18+ marker on a character portrait is a separate `red-600` at 80% alpha over the image.

### Named Rules

**The One Voice Rule.** Nebula Violet is the only saturated solid on a product screen. If a second saturated fill appears, it is an error unless it is a category accent on a character card tag.

**The Aurora Is Scenery Rule.** Fuchsia, pink and amber exist only inside gradients and radial backdrops. They are never text, never a border, never a solid button. A gradient that carries text uses the CTA stops.

**The Muted-on-Tint Rule.** Graphite (`text-muted-foreground`) measures 3.5 to 4.4:1 on aurora- and violet-tinted surfaces. Secondary text on any tinted surface (hero, final CTA, explore and feed headers, feature cards with a wash) uses `text-foreground/75` instead, which stays above 4.5:1 in both themes.

**The Alpha Border Rule.** Borders are the hairline token at 40 to 60% alpha (`border-border/50`) on marketing and glass surfaces, full strength on form controls. Hover raises a border to `primary/30` or `primary/40`; it never changes the fill.

## Typography

**Display Font:** Bricolage Grotesque, variable 200 to 800, self-hosted latin subset (falls back to ui-sans-serif, system-ui)
**Body Font:** Inter, variable 100 to 900, self-hosted latin subset (same fallback)

**Character:** A confident, slightly eccentric grotesque for anything that names or announces, over a neutral, highly legible sans for everything the user reads or types. Headings are tight; body is airy. Both fonts are loaded from `app/fonts/` with no network fetch at build time.

### Hierarchy

- **Display** (800, 3rem to 4.5rem across breakpoints, line-height 0.98, tracking -0.025em, balanced wrapping): the hero headline only. One phrase inside it may be gradient-clipped text.
- **Headline** (700, 1.875rem to 2.25rem, tracking -0.025em, balanced wrapping): section titles on marketing pages, page titles in the dashboard.
- **Title** (600, 1.25rem): feature-card and step titles. Card titles inside product UI drop to 1.125rem semibold with tight tracking.
- **Body** (400, 0.875rem, line-height 1.625): the default reading size. Lead paragraphs use 1.125rem to 1.25rem with `text-wrap: pretty`. Chat messages are body size with relaxed leading.
- **Label** (500, 0.75rem): captions, metadata, chip and badge text. Badges use 600. Portrait overlays on character cards are Label size (12px), never smaller; white at 90%.

### Named Rules

**The Heading Font Is Heading Only Rule.** Bricolage appears on `h1` to `h6`, card and step titles, the brand wordmark, and stat numerals. It never sets a paragraph, a button, or an input.

**The One Gradient Phrase Rule.** Gradient-clipped text is limited to one phrase per page, plus the wordmark and step numerals. A second gradient headline on the same screen is one too many.

## Layout

A centered container with 2rem side padding, capped at 1400px by the framework and at `max-w-6xl` (72rem) on every marketing section. Marketing sections stack with 4rem vertical padding on mobile and 6rem from `md` up, separated by half-alpha hairlines rather than color changes; alternate sections may sit on a 30% Mist wash.

The hero is a two-column grid from `lg` (1.05fr / 0.95fr) with copy left-aligned on the left and the chat-preview card on the right; below `lg` it stacks with 3rem gaps. Feature grids are three columns from `md`, single column below. Character grids run 2 columns on small screens up to 4 at `lg` with 1rem gaps; the portrait is a fixed 3:4 aspect.

The dashboard header is a sticky 4rem (h-16) frosted-glass bar. Product spacing uses the 4px Tailwind scale and a `--density-multiplier` variable (default 1) that scales padding, gap and margin utilities for compact and comfortable modes; new product UI should use the density utilities where users can change density.

Motion is quiet and short: 200ms color and transform transitions on controls, a 500ms fade-in-up on hero elements, a 45s marquee for the category rail that pauses on hover and disables under `prefers-reduced-motion`. Theme changes transition over 200ms and drop to 0ms with reduced motion.

## Elevation & Depth

Flat by default. Depth is conveyed by three things, in order of preference: tonal layering (Mist 1 to 3 or Night 1 to 3), half-alpha hairlines, and frosted glass (`background at 80% alpha with 20px backdrop blur`) for the sticky header and the chat-preview cards. Ordinary cards carry only a border and, in the base primitive, a barely visible `shadow-sm`.

Shadows are reserved as a reward. A hero object gets `shadow-2xl` tinted with deep violet at 10%; the one gradient hero button gets `shadow-lg` in violet at 25%, rising to 40% on hover. Marketing panels may sit on a blurred aurora bloom (`-inset-4` to `-inset-6`, violet 10 to 15%, fuchsia 10%, amber 10%, `blur-2xl`) placed behind them, never on product screens.

### Shadow Vocabulary

- **Rest** (`0 1px 2px 0 rgb(0 0 0 / 0.05)`): the base card primitive. Effectively invisible; may be omitted on new cards.
- **Hero lift** (`0 25px 50px -12px hsl(263 70% 10% / 0.10)`): the chat-preview card and the models panel on the home page.
- **Aurora button** (`0 10px 15px -3px hsl(263 70% 58% / 0.25)`, hover `/ 0.40`): the primary hero CTA only.
- **Ambient glow utilities** (`.glow-sm/md/lg`: 0 0 15/30/60px violet at 15/20/25%): legacy utilities; do not add new uses.

### Named Rules

**The Glow Is Earned Rule.** Glow appears on at most one object per viewport, and that object is a hero or the primary action. Cards, inputs, nav, and lists never glow.

**The Glass Has an Edge Rule.** Every frosted-glass surface carries a `border-border/60` hairline so it reads as a pane, not a smear.

## Shapes

Softly rounded throughout, with radius scaling to the size of the object. Controls (buttons, inputs, base cards) use the `--radius` token of 0.75rem, stepping down to 0.625rem and 0.5rem for small sizes. Product cards use 0.75rem; marketing feature and step cards use 1.5rem; the hero preview and final CTA panel use 2.5rem. Chips, badges, avatars, status dots, and category tags are full pills.

Chat bubbles are 1rem rounded with one top corner cut to 0.375rem: top-left for the AI, top-right for the user. That asymmetry is the signature silhouette of the product and must be preserved wherever a message is rendered.

Portraits are 3:4 with an image-cover, a 60% black gradient over the bottom third for legibility, and pill metadata sitting on 50% black with backdrop blur. Border strokes are 1px everywhere; no 2px outlines except the focus ring.

## Components

### Buttons

- **Shape:** 0.75rem radius at default and icon sizes (`rounded-lg`); 0.625rem at `sm` and `lg`. Height 2.5rem default, 2.25rem small, 2.75rem large, 3rem for the hero CTA.
- **Primary:** Nebula Violet fill, white text, 0.875rem medium Inter, 0.5rem by 1rem padding. Hover drops the fill to 90% alpha. The hero variant swaps the fill for the CTA gradient (`.gradient-bg-cta`, white text ≥ 5.0:1 at every stop) with the aurora button shadow and a right arrow that slides 2px on hover. `.gradient-bg` never sits under text.
- **Hover / Focus:** 200ms `transition-all`; focus-visible shows a 2px Nebula Violet ring offset 2px from the surface. Disabled is 50% opacity with pointer events off.
- **Outline:** transparent with an input-stroke border; hover fills Mist (`accent`). **Secondary:** Mist fill, Ink text, hover 80%. **Ghost:** no border, hover fills Mist. **Link:** violet text, underline on hover offset 4px. **Destructive:** Signal Red fill, white text.
- **`gradient` variant:** `.gradient-bg-cta` with white text and the aurora shadow; the same surface as the hero CTA, for the rare second gradient button (e.g. the pricing upgrade). Use sparingly.

### Chips

- **Style:** pill, `bg-card` with a 60% hairline, 1rem horizontal by 0.5rem vertical padding, 0.875rem medium Graphite text.
- **State:** hover raises the border to violet at 40% and text to Ink. Used for the category marquee and filter rails. Selected state, where needed, uses violet at 10% fill, violet 20% border, violet text (the feed's tag pill).

### Badges

- **Style:** pill, 0.625rem by 0.125rem padding, 0.75rem semibold. Default is Nebula Violet on white; secondary is Mist; destructive is Signal Red; outline is text-only with the current border.

### Cards / Containers

- **Corner Style:** 0.75rem for product cards; 1.5rem for marketing feature and step cards; 2.5rem for hero-scale panels.
- **Background:** `bg-card` (Paper / Night Card). Feature cards on a Mist-washed section use `bg-background` to pop against it.
- **Shadow Strategy:** none or `shadow-sm` at rest; hero lift only on the preview panels. See Elevation.
- **Border:** hairline at 50% alpha; hover moves it to violet 30% and, on feature cards, adds a `shadow-lg` in violet at 5%.
- **Internal Padding:** 1.5rem (base primitive header and content); 1.75rem on marketing cards; 0.75rem on character card bodies.

### Character Card (signature)

A 3:4 portrait card, 0.75rem radius, 50% hairline, `bg-card`, overflow hidden. The image scales to 105% over 300ms on hover. A missing image falls back to the brand gradient (`.gradient-bg`) with the initial letter at 3rem bold white 90%. Bottom-left pills show chats, likes and comments in white on 50% black with blur, but only once at least one count is non-zero; a fresh 0 · 0 · 0 card shows the category tag in that slot instead. An 18+ pill in red 80% sits top-left when applicable. The body carries the name at 0.875rem semibold (turning violet on hover), the creator in Label Graphite, a two-line clamped tagline, and (when the pills are showing) a pill category tag with a per-category color, the one sanctioned place for a non-violet accent.

### Chat Bubble (signature)

User: Nebula Violet fill, white text, `rounded-2xl rounded-tr-md`, right-aligned, max width 85%. AI: Mist (Night 1 in dark) fill, Ink text, `rounded-2xl rounded-tl-md`, left-aligned. Padding 0.625rem by 1rem, body size, relaxed leading. The typing indicator is an AI bubble holding three 6px dots in the current text color at 70% opacity bouncing 4px on a 1s cycle. Reactions sit below the bubble as small pill counters with a hairline border.

### Inputs / Fields

- **Style:** 2.5rem tall, 0.625rem radius (`rounded-md`), `bg-background`, 1px input stroke, 0.75rem horizontal padding, 0.875rem text, Graphite placeholder.
- **Focus:** 2px Nebula Violet ring offset 2px; no border color change.
- **Disabled:** 50% opacity, not-allowed cursor. Errors use Signal Red for helper text.
- Note: the legacy react-hook-form `Input` component still uses hardcoded gray and sky-blue focus rings and predates the token system; new forms use `simple-input` and `textarea`, which are on tokens.

### Navigation

- **Header:** sticky, 4rem tall, frosted glass with a 40% hairline bottom border. Left: the brand mark (gradient-filled logo, 1.5rem) beside the wordmark in Bricolage 1.125rem bold, gradient-clipped. Nav links are 0.875rem medium Graphite that become Ink on hover; no underline, no active pill.
- **Mobile:** links collapse into the dashboard sidebar; the marketing header keeps the wordmark and auth actions.

### Dialogs

Centered from `sm`, bottom-sheet on mobile (`rounded-b-lg` on small screens, `rounded-lg` from `sm`), `bg-background`, 1px border, `shadow-lg`, 1.5rem padding, a 90% fade and slide-in from the bottom. Titles are 1.125rem semibold; descriptions are body Graphite. The close control is a 1rem X at 70% opacity in the top-right.

### Marketing Stage (signature)

The hero and final CTA wrap in `.aurora-backdrop` (three radial glows: violet 22% top-left, fuchsia 16% top-right, amber 10% bottom-right), a `.grain` overlay at 50% opacity to prevent banding, and a masked `.dot-grid` at 7% foreground alpha with 22px spacing. The final CTA repeats the stage inside a 2.5rem-radius panel. This stage is a marketing-only material.

## Do's and Don'ts

### Do:

- **Do** route every color through the semantic tokens (`bg-primary`, `text-muted-foreground`, `border-border/50`); the same component must look right in both themes without a `dark:` override.
- **Do** keep Nebula Violet as the only saturated solid on product screens, and use it for the primary action, the user's bubble, and focus.
- **Do** preserve the asymmetric bubble corners (`rounded-2xl` with `rounded-tl-md` for AI, `rounded-tr-md` for the user) wherever a message renders.
- **Do** set headings in Bricolage with `tracking-tight` and `[text-wrap:balance]`, body in Inter with relaxed leading, and never load a webfont over the network.
- **Do** use hairlines at 50% alpha and tonal layers for structure; escalate to a violet 30% border on hover.
- **Do** confine the aurora backdrop, grain, dot grid, and glow shadows to marketing hero and CTA sections.
- **Do** respect `prefers-reduced-motion`: marquees stop and wrap, theme transitions drop to 0ms, entrance animations may be removed.

### Don't:

- **Don't** introduce a second brand hue. Blue, teal, green and rose fills are off-system except semantic states (green live dot, red destructive and 18+).
- **Don't** put glow, blurred blooms, or `shadow-xl` on cards, inputs, lists, or navigation. Glow is for one hero object per viewport.
- **Don't** use gradient text on more than one phrase per page, and never on body copy, labels, or buttons.
- **Don't** hardcode `gray-*`, `violet-*`, `sky-*`, or `blue-*` utilities in new components; the legacy `Input` primitive and the `gradient` button variant are the anti-reference.
- **Don't** set body text, buttons, or inputs in Bricolage Grotesque.
- **Don't** add sparkle-icon pill badges as decoration; the hero eyebrow pill is the single sanctioned use.
- **Don't** put a kicker or eyebrow label above a section heading; the heading carries its own weight.
- **Don't** put white text on `.gradient-bg`; button-shaped gradient surfaces use `.gradient-bg-cta`.

## Enforcement

Five of the rules above are machine-checked, so breaking them fails the build the
way a type error does. `scripts/check-design-system.mjs` runs in CI right after
`lint`; run it locally with:

```bash
bun run design:check                       # grouped, readable report
node scripts/check-design-system.mjs --json  # machine output
```

It reads `app/**/*.tsx` (no dependencies, well under a second) and enforces:

| Rule                         | What fails                                                                                                                                                                                                                                                           |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hardcoded palette            | `bg-/text-/border-/from-/…-{gray,slate,zinc,neutral,stone,violet,purple,blue,sky,indigo,pink,fuchsia,rose,cyan,teal}-NNN` anywhere in `app/`. Route color through the semantic tokens; semantic status hues (green, emerald, amber, yellow, orange, red) stay legal. |
| The One Gradient Phrase Rule | More than one `.gradient-text` per rendered marketing page (the page plus the components it imports). Wordmark and step numerals are exempt.                                                                                                                         |
| Sparkle eyebrow pills        | A sparkle icon inside a `rounded-full border` element on a marketing page, beyond the one sanctioned home hero.                                                                                                                                                      |
| Small violet text            | `text-primary` in the same `className` as `text-xs`/`text-sm`; use `text-primary-accent`, which is the token that clears 4.5:1 in both themes.                                                                                                                       |
| Label size floor             | `text-[Npx]` below 12px.                                                                                                                                                                                                                                             |

What is _not_ checked is not thereby allowed — glow placement, bubble corner
asymmetry, and font pairing still need a human eye.

Genuine exceptions live in one place: the `ALLOWLIST` constant at the top of the
script, one entry per exception with a one-line reason. It currently exempts the
per-category color maps (character portrait gradients, memory categories,
suggestion types) where the hue encodes data rather than style, the dev-only
Tailwind breakpoint indicator, the how-it-works step numerals, and the single
home-hero eyebrow pill. Widening the allowlist is a policy decision and should
read like one in the diff; loosening a rule's regex to make a violation
disappear is not.
