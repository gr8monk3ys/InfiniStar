// Global manual mock for posthog-node. .env.ci.example sets a dummy
// POSTHOG_API_KEY, so any suite that exercises a route calling
// captureServerEvent() would otherwise construct a real client and fire
// network requests after teardown ("Cannot log after tests are done").
// Suites that need to assert on PostHog behavior override this with their
// own jest.mock("posthog-node", ...) factory.
class PostHog {
  capture() {}
  identify() {}
  flush() {
    return Promise.resolve()
  }
  shutdown() {
    return Promise.resolve()
  }
}

module.exports = { __esModule: true, PostHog }
