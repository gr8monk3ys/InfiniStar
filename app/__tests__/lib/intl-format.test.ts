import {
  formatDate,
  formatDateTime,
  formatNumber,
  formatRelative,
  formatTime,
} from "@/app/lib/intl-format"

const AT = new Date("2026-09-23T16:05:00Z")

describe("intl-format", () => {
  it("formats dates and times through Intl for the given locale", () => {
    expect(formatDate(AT, { dateStyle: "medium", timeZone: "UTC" }, "en-US")).toBe("Sep 23, 2026")
    expect(formatDate(AT, { dateStyle: "medium", timeZone: "UTC" }, "de-DE")).toBe("23.09.2026")
    expect(formatTime(AT.toISOString(), "en-US")).toMatch(/\d{1,2}:\d{2}/)
    expect(formatDateTime(AT.getTime(), "en-US")).toMatch(/2026/)
  })

  it("formats numbers with locale grouping", () => {
    expect(formatNumber(1234567, {}, "en-US")).toBe("1,234,567")
    expect(formatNumber(1234567, {}, "de-DE")).toBe("1.234.567")
  })

  it("formats relative time with the largest whole unit", () => {
    const now = AT.getTime()
    expect(formatRelative(now - 3 * 60 * 60 * 1000, now, "en-US")).toBe("3 hours ago")
    expect(formatRelative(now + 2 * 24 * 60 * 60 * 1000, now, "en-US")).toBe("in 2 days")
    expect(formatRelative(now - 24 * 60 * 60 * 1000, now, "en-US")).toBe("yesterday")
    expect(formatRelative(now, now, "en-US")).toBe("now")
  })
})
