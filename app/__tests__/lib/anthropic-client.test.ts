import anthropic, { resetAnthropicClientForTests } from "@/app/lib/anthropic"

/**
 * @jest-environment node
 */

/**
 * The model rewrite happens inside a Proxy, which is exactly the kind of thing
 * that fails silently: a route asks for `claude-sonnet-4-6`, the gateway has
 * never heard of it, and the only symptom is a 404 from a vendor nobody
 * realised was in the path.
 */

type Params = Record<string, unknown>
interface ClientOptions {
  baseURL?: string
  apiKey?: string
  defaultHeaders?: Record<string, string>
}

const construct = jest.fn((_opts: ClientOptions) => undefined)
const create = jest.fn(async (_params: Params) => ({ ok: true }))
const stream = jest.fn(async (_params: Params) => ({ ok: true }))
const countTokens = jest.fn(async (_params: Params) => ({ input_tokens: 1 }))

jest.mock("@anthropic-ai/sdk", () => ({
  __esModule: true,
  default: class {
    messages = { create, stream, countTokens }
    constructor(opts: ClientOptions) {
      construct(opts)
    }
  },
}))

const ORIGINAL_ENV = process.env

function setEnv(env: Record<string, string | undefined>) {
  process.env = {
    ...ORIGINAL_ENV,
    ANTHROPIC_API_KEY: undefined,
    AI_GATEWAY_API_KEY: undefined,
    VERCEL_OIDC_TOKEN: undefined,
    AI_GATEWAY_MODEL_SONNET: undefined,
    AI_GATEWAY_MODEL_HAIKU: undefined,
    ...env,
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  resetAnthropicClientForTests()
})

afterEach(() => {
  process.env = ORIGINAL_ENV
  resetAnthropicClientForTests()
})

describe("the model client", () => {
  it("sends the app's own model id straight through to Anthropic", async () => {
    setEnv({ ANTHROPIC_API_KEY: "sk-ant" })

    await anthropic.messages.create({ model: "claude-sonnet-4-6", max_tokens: 8, messages: [] })

    expect(create.mock.calls[0][0].model).toBe("claude-sonnet-4-6")
    expect(construct.mock.calls[0][0].baseURL).toBeUndefined()
  })

  it("rewrites the model and points at the gateway when falling back", async () => {
    setEnv({ VERCEL_OIDC_TOKEN: "oidc" })

    await anthropic.messages.create({ model: "claude-sonnet-4-6", max_tokens: 8, messages: [] })

    expect(create.mock.calls[0][0].model).toBe("anthropic/claude-sonnet-4.6")
    const opts = construct.mock.calls[0][0]
    expect(opts.baseURL).toBe("https://ai-gateway.vercel.sh")
    expect(opts.defaultHeaders?.Authorization).toBe("Bearer oidc")
  })

  it("rewrites for streaming too — the main chat path", async () => {
    setEnv({ VERCEL_OIDC_TOKEN: "oidc", AI_GATEWAY_MODEL_SONNET: "zai/glm-4.6" })

    await anthropic.messages.stream({ model: "claude-sonnet-4-6", max_tokens: 8, messages: [] })

    expect(stream.mock.calls[0][0].model).toBe("zai/glm-4.6")
  })

  it("leaves everything but the model untouched", async () => {
    setEnv({ VERCEL_OIDC_TOKEN: "oidc" })

    await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 64,
      system: "be terse",
      messages: [{ role: "user", content: "hi" }],
    })

    const sent = create.mock.calls[0][0]
    expect(sent.max_tokens).toBe(64)
    expect(sent.system).toBe("be terse")
    expect(sent.messages).toEqual([{ role: "user", content: "hi" }])
  })

  it("passes other Messages members through, so countTokens still works", async () => {
    setEnv({ ANTHROPIC_API_KEY: "sk-ant" })

    await anthropic.messages.countTokens({ model: "claude-haiku-4-5", messages: [] })

    expect(countTokens).toHaveBeenCalled()
  })

  it("says what is missing when no provider is configured", () => {
    setEnv({})

    expect(() => anthropic.messages).toThrow(/No model provider is configured/)
  })
})
