// Learn more: https://github.com/testing-library/jest-dom
import "@testing-library/jest-dom"

// Polyfill for Response global (used in CORS tests)
if (typeof Response === "undefined") {
  class MockResponse {
    constructor(body, init = {}) {
      this.body = body
      this.status = init.status || 200
      this.statusText = init.statusText || ""
      this._headers = new Map()

      if (init.headers) {
        if (init.headers instanceof Map) {
          init.headers.forEach((value, key) => this._headers.set(key, value))
        } else if (typeof init.headers === "object") {
          Object.entries(init.headers).forEach(([key, value]) => this._headers.set(key, value))
        }
      }
    }

    get headers() {
      return {
        get: (key) => this._headers.get(key) || null,
        has: (key) => this._headers.has(key),
        entries: () => this._headers.entries(),
        forEach: (cb) => this._headers.forEach(cb),
      }
    }

    json() {
      return Promise.resolve(JSON.parse(this.body))
    }

    text() {
      return Promise.resolve(this.body)
    }
  }

  global.Response = MockResponse
}

// Polyfill for TextEncoder/TextDecoder used by Prisma/crypto deps in Jest
if (typeof TextEncoder === "undefined" || typeof TextDecoder === "undefined") {
  const { TextEncoder, TextDecoder } = require("node:util")
  global.TextEncoder = TextEncoder
  global.TextDecoder = TextDecoder
}
