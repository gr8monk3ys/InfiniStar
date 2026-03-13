import Anthropic from "@anthropic-ai/sdk"

// In test environments that register DOM globals (e.g. @happy-dom/global-registrator),
// the Anthropic SDK's isRunningInBrowser() check triggers because `window` is defined.
// We only set dangerouslyAllowBrowser when both window AND process.versions are defined:
// process.versions is a Node.js/Bun-only API that is never available in real browsers,
// so this can never be true in a production browser context (where it would be unsafe).
const dangerouslyAllowBrowser =
  typeof window !== "undefined" && typeof process !== "undefined" && process.versions != null

let _anthropic: Anthropic | undefined

function getAnthropicClient(): Anthropic {
  if (!_anthropic) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error("Missing ANTHROPIC_API_KEY environment variable")
    }
    _anthropic = new Anthropic({ apiKey, dangerouslyAllowBrowser })
  }
  return _anthropic
}

const anthropic = new Proxy({} as Anthropic, {
  get(_target, prop, receiver) {
    const client = getAnthropicClient()
    const value = Reflect.get(client, prop, receiver)
    return typeof value === "function" ? value.bind(client) : value
  },
})

export default anthropic
