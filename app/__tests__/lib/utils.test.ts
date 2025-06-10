import { cn } from "@/app/lib/utils"

describe("cn utility function", () => {
  it("should merge class names correctly", () => {
    const result = cn("text-red-500", "bg-blue-500")
    expect(result).toContain("text-red-500")
    expect(result).toContain("bg-blue-500")
  })

  it("should handle conditional classes", () => {
    const shouldHide = false
    const result = cn("base-class", shouldHide && "hidden", "visible")
    expect(result).toContain("base-class")
    expect(result).toContain("visible")
    expect(result).not.toContain("hidden")
  })

  it("should handle undefined and null values", () => {
    const result = cn("base-class", undefined, null, "another-class")
    expect(result).toContain("base-class")
    expect(result).toContain("another-class")
  })
})
