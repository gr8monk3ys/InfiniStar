import {
  escapeHtml,
  sanitizeEmail,
  sanitizeFilename,
  sanitizeHtml,
  sanitizeMessage,
  sanitizePlainText,
  sanitizeUrl,
} from "@/app/lib/sanitize"

describe("Sanitization Functions", () => {
  describe("sanitizeHtml", () => {
    it("should remove script tags", () => {
      const input = '<script>alert("xss")</script><p>Hello</p>'
      const result = sanitizeHtml(input)
      expect(result).not.toContain("<script>")
      expect(result).toContain("<p>Hello</p>")
    })

    it("should allow safe tags", () => {
      const input = "<p>Test</p><strong>Bold</strong><em>Italic</em>"
      const result = sanitizeHtml(input)
      expect(result).toContain("<p>Test</p>")
      expect(result).toContain("<strong>Bold</strong>")
      expect(result).toContain("<em>Italic</em>")
    })

    it("should remove event handlers", () => {
      const input = '<p onclick="alert(1)">Click me</p>'
      const result = sanitizeHtml(input)
      expect(result).not.toContain("onclick")
      expect(result).toContain("Click me")
    })

    it("should handle empty input", () => {
      expect(sanitizeHtml("")).toBe("")
      expect(sanitizeHtml(null as unknown as string)).toBe("")
      expect(sanitizeHtml(undefined as unknown as string)).toBe("")
    })
  })

  describe("sanitizePlainText", () => {
    it("should strip all HTML tags", () => {
      const input = '<script>alert("xss")</script><p>Hello</p><strong>World</strong>'
      const result = sanitizePlainText(input)
      expect(result).toBe("HelloWorld")
    })

    it("should preserve plain text content", () => {
      const input = "Just plain text"
      const result = sanitizePlainText(input)
      expect(result).toBe("Just plain text")
    })

    it("should handle empty input", () => {
      expect(sanitizePlainText("")).toBe("")
      expect(sanitizePlainText(null as unknown as string)).toBe("")
    })
  })

  describe("sanitizeMessage", () => {
    it("should strip HTML but preserve line breaks", () => {
      const input = '<script>alert("xss")</script>Hello\nWorld'
      const result = sanitizeMessage(input)
      expect(result).not.toContain("<script>")
      expect(result).toContain("Hello<br>World")
    })

    it("should handle empty input", () => {
      expect(sanitizeMessage("")).toBe("")
    })
  })

  describe("sanitizeUrl", () => {
    it("should allow HTTP and HTTPS URLs", () => {
      expect(sanitizeUrl("https://example.com")).toBe("https://example.com")
      expect(sanitizeUrl("http://example.com")).toBe("http://example.com")
    })

    it("should block javascript: URLs", () => {
      expect(sanitizeUrl("javascript:alert(1)")).toBe("")
      expect(sanitizeUrl("JavaScript:alert(1)")).toBe("")
    })

    it("should block data: URLs", () => {
      expect(sanitizeUrl("data:text/html,<script>alert(1)</script>")).toBe("")
    })

    it("should block file: URLs", () => {
      expect(sanitizeUrl("file:///etc/passwd")).toBe("")
    })

    it("should allow mailto and tel URLs", () => {
      expect(sanitizeUrl("mailto:user@example.com")).toBe("mailto:user@example.com")
      expect(sanitizeUrl("tel:+1234567890")).toBe("tel:+1234567890")
    })

    it("should handle empty input", () => {
      expect(sanitizeUrl("")).toBe("")
      expect(sanitizeUrl(null as unknown as string)).toBe("")
    })
  })

  describe("sanitizeFilename", () => {
    it("should remove path traversal attempts", () => {
      expect(sanitizeFilename("../../../etc/passwd")).toBe("_.._.._etc_passwd")
    })

    it("should replace invalid characters", () => {
      expect(sanitizeFilename("my file?.txt")).toBe("my_file_.txt")
    })

    it("should remove leading dots", () => {
      expect(sanitizeFilename("...hidden")).toBe("hidden")
    })

    it("should limit filename length", () => {
      const longName = "a".repeat(300)
      const result = sanitizeFilename(longName)
      expect(result.length).toBeLessThanOrEqual(255)
    })

    it("should handle empty input", () => {
      expect(sanitizeFilename("")).toBe("unnamed")
      expect(sanitizeFilename(null as unknown as string)).toBe("unnamed")
    })
  })

  describe("sanitizeEmail", () => {
    it("should accept valid email addresses", () => {
      expect(sanitizeEmail("user@example.com")).toBe("user@example.com")
      expect(sanitizeEmail("USER@EXAMPLE.COM")).toBe("user@example.com")
    })

    it("should reject invalid email addresses", () => {
      expect(sanitizeEmail("not an email")).toBe("")
      expect(sanitizeEmail("@example.com")).toBe("")
      expect(sanitizeEmail("user@")).toBe("")
    })

    it("should trim whitespace", () => {
      expect(sanitizeEmail("  user@example.com  ")).toBe("user@example.com")
    })

    it("should handle empty input", () => {
      expect(sanitizeEmail("")).toBe("")
      expect(sanitizeEmail(null as unknown as string)).toBe("")
    })
  })

  describe("escapeHtml", () => {
    it("should escape HTML entities", () => {
      const input = '<script>alert("xss")</script>'
      const result = escapeHtml(input)
      expect(result).toBe("&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;")
    })

    it("should escape ampersands", () => {
      expect(escapeHtml("Tom & Jerry")).toContain("&amp;")
    })

    it("should handle empty input", () => {
      expect(escapeHtml("")).toBe("")
      expect(escapeHtml(null as unknown as string)).toBe("")
    })
  })
})
