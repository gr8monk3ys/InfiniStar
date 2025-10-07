// DOM globals for component tests.
// @happy-dom/global-registrator patches globalThis directly (no separate VM context),
// making window, document, HTMLElement, etc. available to @testing-library/react.
import { GlobalRegistrator } from "@happy-dom/global-registrator"

/**
 * Bun test preload file.
 *
 * Runs before every test file. Provides:
 *  1. Stub env vars so modules that validate/read env at load time don't throw.
 *  2. No-op polyfills for Jest APIs Bun doesn't implement.
 *  3. DOM globals via @happy-dom/global-registrator for component tests.
 *     Uses globalThis patching (not a separate VM context) so there is no
 *     cross-realm Event rejection when @radix-ui dispatches native events.
 */

// Prevent @t3-oss/env-nextjs from throwing at import time.
// Tests that need real env values mock the specific modules they depend on.
process.env.SKIP_ENV_VALIDATION = "1"

// Prevent app/lib/prismadb.ts from throwing "DATABASE_URL is not configured".
// Tests mock @/app/lib/prismadb, so this stub value is never used to connect.
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgresql://stub:stub@localhost/test"
}

// jest.resetModules() — Bun's runner doesn't implement this.
// Most callers use it defensively (for modules that read env at call time, not init time).
// Those tests work correctly with a no-op. Tests that truly need module reload
// should use Bun's mock.module() or restructure to avoid module-level side effects.
if (typeof jest !== "undefined" && !jest.resetModules) {
  ;(jest as unknown as Record<string, unknown>).resetModules = () => {}
}

GlobalRegistrator.register({ url: "http://localhost/", width: 1024, height: 768 })

// Cross-file DOM cleanup.
// Bun 1.3.9 runs all test files in a single shared process with one document.body.
// Radix UI dialogs/portals inject elements directly into body and may not clean up
// fully between test files (e.g. data-scroll-locked, leftover portal nodes).
// This beforeEach resets body to a clean slate before every individual test so that
// @testing-library/react always has a clean container to render into.
if (typeof beforeEach !== "undefined") {
  beforeEach(() => {
    // replaceChildren() removes all child nodes — safer than innerHTML for test cleanup
    document.body.replaceChildren()
    document.body.removeAttribute("data-scroll-locked")
    document.body.style.cssText = ""
  })
}

// Patch Node.prototype.removeChild to not throw when the child was already detached.
// React's portal cleanup (commitDeletionEffectsOnFiber) calls body.removeChild(portalNode)
// after our beforeEach has already cleared body with replaceChildren(). In a test context
// this is harmless — the node is gone, which is what we wanted. Real browsers throw
// NotFoundError DOMException but we suppress it here to prevent spurious test failures.
;(function patchRemoveChild() {
  const proto = Node.prototype as unknown as Record<string, unknown>
  const original = proto["removeChild"] as <T extends Node>(child: T) => T
  proto["removeChild"] = function removeChild<T extends Node>(this: Node, child: T): T {
    try {
      return original.call(this, child) as T
    } catch {
      // Node was already removed (e.g. by body.replaceChildren() in beforeEach).
      // Return child silently — the removal goal is already achieved.
      return child
    }
  }
})()
