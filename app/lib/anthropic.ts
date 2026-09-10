/**
 * The model client.
 *
 * Still the Anthropic SDK and still one default export, because seven modules
 * import it and the SDK's Messages API is the shape they are all written
 * against. What changed is who answers: `model-provider.ts` decides between
 * Anthropic direct and Vercel's AI Gateway, and the gateway speaks the same
 * Messages API for models that are not Anthropic's at all. See that module for
 * the ordering and its caveats.
 *
 * Model ids are rewritten here rather than at the call sites. A route asks for
 * `claude-sonnet-4-6`; through the gateway that has to become
 * `anthropic/claude-sonnet-4.6`, or whatever `AI_GATEWAY_MODEL_SONNET` names.
 * Doing it in the proxy keeps every caller — and every test that mocks one —
 * written in the app's own vocabulary.
 */

import Anthropic from "@anthropic-ai/sdk"

import { resolveModelProvider } from "@/app/lib/model-provider"

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
    const provider = resolveModelProvider()
    if (provider.kind === "none") {
      throw new Error(
        "No model provider is configured. Set ANTHROPIC_API_KEY, or AI_GATEWAY_API_KEY " +
          "to route through Vercel's AI Gateway."
      )
    }

    _anthropic = new Anthropic({
      // The SDK requires *something* here even when the real credential rides
      // in an Authorization header, so the gateway path passes its own token.
      apiKey: provider.apiKey ?? provider.authToken,
      baseURL: provider.baseURL,
      defaultHeaders: provider.authToken
        ? { Authorization: `Bearer ${provider.authToken}` }
        : undefined,
      dangerouslyAllowBrowser,
    })
  }
  return _anthropic
}

/** Rewrites `params.model` on its way through, leaving everything else alone. */
function withResolvedModel<T extends { model?: unknown }>(params: T): T {
  if (typeof params?.model !== "string") return params
  const resolved = resolveModelProvider().resolveModel(params.model)
  return resolved === params.model ? params : { ...params, model: resolved }
}

/**
 * Wraps the Messages resource so `create` and `stream` see the provider's own
 * model id. Every other member passes through untouched, so `countTokens` and
 * `batches` keep working.
 */
function wrapMessages(messages: Anthropic["messages"]): Anthropic["messages"] {
  return new Proxy(messages, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver)
      if (typeof value !== "function") return value
      const fn = value.bind(target)
      if (prop !== "create" && prop !== "stream") return fn
      return (params: { model?: unknown }, ...rest: unknown[]) =>
        fn(withResolvedModel(params), ...rest)
    },
  }) as Anthropic["messages"]
}

const anthropic = new Proxy({} as Anthropic, {
  get(_target, prop, receiver) {
    const client = getAnthropicClient()
    const value = Reflect.get(client, prop, receiver)
    if (prop === "messages") return wrapMessages(value as Anthropic["messages"])
    return typeof value === "function" ? value.bind(client) : value
  },
})

export default anthropic

/** Test-only: drops the memoised client so a new environment takes effect. */
export function resetAnthropicClientForTests(): void {
  _anthropic = undefined
}
