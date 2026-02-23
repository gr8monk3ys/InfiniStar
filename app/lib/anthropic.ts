import Anthropic from "@anthropic-ai/sdk"

// In test environments that register DOM globals (e.g. @happy-dom/global-registrator),
// the Anthropic SDK's isRunningInBrowser() check triggers because `window` is defined.
// We only set dangerouslyAllowBrowser when both window AND process.versions are defined:
// process.versions is a Node.js/Bun-only API that is never available in real browsers,
// so this can never be true in a production browser context (where it would be unsafe).
const dangerouslyAllowBrowser =
  typeof window !== "undefined" && typeof process !== "undefined" && process.versions != null

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "",
  dangerouslyAllowBrowser,
})

export default anthropic
