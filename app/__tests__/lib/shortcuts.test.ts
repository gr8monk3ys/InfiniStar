/**
 * Keyboard shortcut registry tests.
 *
 * Everything is exercised through the module's own interface (`shortcuts`);
 * the storage keys are asserted as literals so the persisted format stays
 * pinned even though the constants are private.
 */
import { shortcuts, type ShortcutBinding } from "@/app/lib/shortcuts"

const STORAGE_KEY = "infinstar-custom-shortcuts"
const ENABLED_KEY = "infinstar-shortcuts-enabled"

function setPlatform(platform: string) {
  Object.defineProperty(window.navigator, "platform", {
    configurable: true,
    value: platform,
  })
}

function keydown(
  key: string,
  modifiers: { meta?: boolean; ctrl?: boolean; shift?: boolean; alt?: boolean } = {}
): KeyboardEvent {
  return new KeyboardEvent("keydown", {
    key,
    metaKey: modifiers.meta ?? false,
    ctrlKey: modifiers.ctrl ?? false,
    shiftKey: modifiers.shift ?? false,
    altKey: modifiers.alt ?? false,
  })
}

/** The platform-agnostic "Cmd on mac, Ctrl elsewhere" press. */
function metaPress(key: string, extra: { shift?: boolean; alt?: boolean } = {}) {
  const mac = shortcuts.platform().isMac
  return keydown(key, { meta: mac, ctrl: !mac, ...extra })
}

beforeEach(() => {
  window.localStorage.clear()
  shortcuts.reload()
  setPlatform("MacIntel")
  document.body.innerHTML = ""
})

afterAll(() => {
  window.localStorage.clear()
  shortcuts.reload()
})

describe("shortcuts.resolve — key matching", () => {
  it("resolves the meta binding using Cmd on mac", () => {
    setPlatform("MacIntel")
    expect(shortcuts.resolve(keydown("k", { meta: true }))).toBe("globalSearch")
  })

  it("does not resolve the meta binding from Ctrl on mac", () => {
    setPlatform("MacIntel")
    expect(shortcuts.resolve(keydown("k", { ctrl: true }))).toBeNull()
  })

  it("resolves the meta binding using Ctrl off mac", () => {
    setPlatform("Win32")
    expect(shortcuts.resolve(keydown("k", { ctrl: true }))).toBe("globalSearch")
  })

  it("does not resolve the meta binding from Cmd off mac", () => {
    setPlatform("Win32")
    expect(shortcuts.resolve(keydown("k", { meta: true }))).toBeNull()
  })

  it("returns null for a bare key that only exists as a modified binding", () => {
    expect(shortcuts.resolve(keydown("k"))).toBeNull()
  })

  it("matches keys case-insensitively", () => {
    expect(shortcuts.resolve(keydown("K", { meta: true }))).toBe("globalSearch")
  })

  it("distinguishes bindings that share a key by their modifiers", () => {
    expect(shortcuts.resolve(keydown("Enter", { meta: true }))).toBe("sendMessage")
    expect(shortcuts.resolve(keydown("Enter", { shift: true }))).toBe("newLine")
    expect(shortcuts.resolve(keydown("Enter"))).toBe("openConversation")
  })

  it("rejects a match when an unwanted modifier is held", () => {
    expect(shortcuts.resolve(keydown("k", { meta: true, alt: true }))).toBeNull()
    expect(shortcuts.resolve(keydown("k", { meta: true, shift: true }))).toBeNull()
  })

  it("requires every modifier of a multi-modifier binding", () => {
    expect(shortcuts.resolve(keydown("d", { meta: true, shift: true }))).toBe("toggleTheme")
    expect(shortcuts.resolve(keydown("d", { meta: true }))).toBeNull()
  })

  it("requires ctrl to be held for a ctrl binding on mac", () => {
    setPlatform("MacIntel")
    shortcuts.rebind("focusInput", { key: "i", modifiers: ["ctrl"] })

    // Regression: the bare key used to satisfy a ctrl-only binding, because
    // ctrl was never checked when the platform meta key was Cmd.
    expect(shortcuts.resolve(keydown("i"))).toBeNull()
    expect(shortcuts.resolve(keydown("i", { ctrl: true }))).toBe("focusInput")
  })
})

describe("shortcuts.resolve — candidates", () => {
  it("only considers the candidates it is given, in their order", () => {
    expect(
      shortcuts.resolve(keydown("k", { meta: true }), { among: [{ id: "newConversation" }] })
    ).toBeNull()
    expect(
      shortcuts.resolve(keydown("k", { meta: true }), {
        among: [{ id: "newConversation" }, { id: "globalSearch" }],
      })
    ).toBe("globalSearch")
  })

  it("skips candidates that are explicitly disabled", () => {
    expect(
      shortcuts.resolve(keydown("k", { meta: true }), {
        among: [{ id: "globalSearch", enabled: false }],
      })
    ).toBeNull()
  })

  it("returns the first matching candidate when two share a binding", () => {
    shortcuts.rebind("focusInput", { key: "k", modifiers: ["meta"] }, { force: true })

    expect(
      shortcuts.resolve(keydown("k", { meta: true }), {
        among: [{ id: "focusInput" }, { id: "globalSearch" }],
      })
    ).toBe("focusInput")
  })
})

describe("shortcuts.resolve — typing suppression", () => {
  it("suppresses ordinary shortcuts while typing in an input", () => {
    const input = document.createElement("input")
    document.body.appendChild(input)
    input.focus()

    expect(shortcuts.resolve(keydown("k", { meta: true }))).toBeNull()
  })

  it("suppresses shortcuts while typing in a textarea or contenteditable", () => {
    const textarea = document.createElement("textarea")
    document.body.appendChild(textarea)
    textarea.focus()
    expect(shortcuts.resolve(keydown("k", { meta: true }))).toBeNull()

    const editable = document.createElement("div")
    editable.setAttribute("contenteditable", "true")
    editable.setAttribute("tabindex", "0")
    document.body.appendChild(editable)
    editable.focus()
    expect(shortcuts.resolve(keydown("k", { meta: true }))).toBeNull()
  })

  it("still fires actions that allow input focus", () => {
    const input = document.createElement("input")
    document.body.appendChild(input)
    input.focus()

    expect(shortcuts.resolve(keydown("Enter", { meta: true }))).toBe("sendMessage")
  })

  it("honours a per-candidate allowInInput override", () => {
    expect(
      shortcuts.resolve(keydown("k", { meta: true }), {
        typing: true,
        among: [{ id: "globalSearch", allowInInput: true }],
      })
    ).toBe("globalSearch")
  })

  it("accepts an explicit typing flag instead of inspecting focus", () => {
    expect(shortcuts.resolve(keydown("k", { meta: true }), { typing: true })).toBeNull()
    expect(shortcuts.resolve(keydown("k", { meta: true }), { typing: false })).toBe("globalSearch")
  })
})

describe("shortcuts.matches — ad-hoc bindings", () => {
  const voiceInput: ShortcutBinding = { key: "v", modifiers: ["meta", "shift"] }

  it("matches a binding that is not a registry action", () => {
    expect(shortcuts.matches(metaPress("v", { shift: true }), voiceInput, { typing: false })).toBe(
      true
    )
    expect(shortcuts.matches(metaPress("v"), voiceInput, { typing: false })).toBe(false)
  })

  it("suppresses while typing unless allowInInput is set", () => {
    const event = metaPress("v", { shift: true })
    expect(shortcuts.matches(event, voiceInput, { typing: true })).toBe(false)
    expect(shortcuts.matches(event, voiceInput, { typing: true, allowInInput: true })).toBe(true)
  })
})

describe("shortcuts.list / groups", () => {
  it("hides shortcuts marked hidden by default", () => {
    const ids = shortcuts.list().map((action) => action.id)
    expect(ids).toContain("globalSearch")
    expect(ids).not.toContain("closeModal")
    expect(ids).not.toContain("openConversation")
    expect(ids).not.toContain("showHelpQuestion")
  })

  it("includes hidden shortcuts on request", () => {
    const ids = shortcuts.list({ includeHidden: true }).map((action) => action.id)
    expect(ids).toContain("closeModal")
    expect(shortcuts.list({ includeHidden: true }).length).toBeGreaterThan(shortcuts.list().length)
  })

  it("filters by category", () => {
    const messages = shortcuts.list({ category: "messages" })
    expect(messages.length).toBeGreaterThan(0)
    expect(messages.every((action) => action.category === "messages")).toBe(true)
  })

  it("groups visible shortcuts by category in display order", () => {
    const groups = shortcuts.groups()
    expect(groups.map((group) => group.category)).toEqual([
      "navigation",
      "conversations",
      "messages",
      "general",
    ])
    expect(groups[0].label).toBe("Navigation")
    expect(groups[0].description).toBe("Move around the application")
    expect(groups.flatMap((group) => group.shortcuts).map((s) => s.id)).not.toContain("closeModal")
  })
})

describe("shortcuts.binding / display / platform", () => {
  it("reads the default binding when nothing is customised", () => {
    expect(shortcuts.binding("globalSearch")).toEqual({ key: "k", modifiers: ["meta"] })
  })

  it("reads the custom binding once one is set", () => {
    shortcuts.rebind("globalSearch", { key: "j", modifiers: ["meta", "shift"] })
    expect(shortcuts.binding("globalSearch")).toEqual({ key: "j", modifiers: ["meta", "shift"] })
  })

  it("formats an action's effective binding per platform", () => {
    setPlatform("MacIntel")
    expect(shortcuts.display("globalSearch")).toBe("Cmd+K")
    setPlatform("Win32")
    expect(shortcuts.display("globalSearch")).toBe("Ctrl+K")
  })

  it("formats a bare binding, including special keys and modifier order", () => {
    setPlatform("MacIntel")
    expect(shortcuts.display({ key: "ArrowDown", modifiers: ["shift", "meta"] })).toBe(
      "Cmd+Shift+↓"
    )
    expect(shortcuts.display({ key: "Escape", modifiers: [] })).toBe("Esc")
  })

  it("formats with mac symbols on request", () => {
    setPlatform("MacIntel")
    expect(shortcuts.display({ key: "d", modifiers: ["meta", "shift"] }, { style: "symbol" })).toBe(
      "⌘⇧D"
    )
    setPlatform("Win32")
    expect(shortcuts.display({ key: "d", modifiers: ["meta", "shift"] }, { style: "symbol" })).toBe(
      "CtrlShiftD"
    )
  })

  it("reports the platform modifier labels", () => {
    setPlatform("MacIntel")
    expect(shortcuts.platform()).toEqual({
      isMac: true,
      modifierKey: "Cmd",
      modifierSymbol: "⌘",
    })
    setPlatform("Linux x86_64")
    expect(shortcuts.platform()).toEqual({
      isMac: false,
      modifierKey: "Ctrl",
      modifierSymbol: "Ctrl",
    })
  })
})

describe("shortcuts.rebind", () => {
  it("persists an accepted binding under the storage key", () => {
    const result = shortcuts.rebind("focusInput", { key: "j", modifiers: ["meta"] })

    expect(result).toEqual({ ok: true })
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) as string)).toEqual({
      focusInput: { key: "j", modifiers: ["meta"] },
    })
    expect(shortcuts.resolve(keydown("j", { meta: true }))).toBe("focusInput")
  })

  it("refuses a binding with no modifier when the action requires one", () => {
    const result = shortcuts.rebind("focusInput", { key: "j", modifiers: [] })

    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/requires at least one modifier/)
    expect(shortcuts.binding("focusInput")).toEqual({ key: "i", modifiers: ["meta"] })
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it("refuses function keys", () => {
    const result = shortcuts.rebind("focusInput", { key: "F5", modifiers: ["meta"] })
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/Function keys are reserved/)
  })

  it("refuses a bare single character even when no modifier is required", () => {
    const result = shortcuts.rebind("showHelpQuestion", { key: "a", modifiers: [] })
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/Single character shortcuts/)
  })

  it("allows a bare non-alphanumeric key when no modifier is required", () => {
    expect(shortcuts.rebind("showHelpQuestion", { key: "!", modifiers: [] })).toEqual({ ok: true })
  })

  it("refuses a binding already used by another action, and names it", () => {
    const result = shortcuts.rebind("focusInput", { key: "k", modifiers: ["meta"] })

    expect(result.ok).toBe(false)
    expect(result.conflicts).toEqual([{ actionId: "globalSearch", actionName: "Global Search" }])
    expect(shortcuts.binding("focusInput")).toEqual({ key: "i", modifiers: ["meta"] })
  })

  it("detects a conflict against another action's custom binding, not just defaults", () => {
    shortcuts.rebind("focusInput", { key: "j", modifiers: ["meta"] })

    const result = shortcuts.rebind("toggleSidebar", { key: "j", modifiers: ["meta"] })
    expect(result.ok).toBe(false)
    expect(result.conflicts?.map((c) => c.actionId)).toEqual(["focusInput"])
  })

  it("ignores modifier order when comparing bindings for conflicts", () => {
    const result = shortcuts.rebind("focusInput", { key: "d", modifiers: ["shift", "meta"] })
    expect(result.conflicts?.map((c) => c.actionId)).toEqual(["toggleTheme"])
  })

  it("does not report an action as conflicting with itself", () => {
    expect(shortcuts.rebind("globalSearch", { key: "k", modifiers: ["meta"] })).toEqual({
      ok: true,
    })
  })

  it("applies a conflicting binding when forced, still reporting the conflict", () => {
    const result = shortcuts.rebind(
      "focusInput",
      { key: "k", modifiers: ["meta"] },
      { force: true }
    )

    expect(result.ok).toBe(true)
    expect(result.conflicts?.map((c) => c.actionId)).toEqual(["globalSearch"])
    expect(shortcuts.binding("focusInput")).toEqual({ key: "k", modifiers: ["meta"] })
  })
})

describe("shortcuts.reset", () => {
  it("restores one action and leaves the others customised", () => {
    shortcuts.rebind("focusInput", { key: "j", modifiers: ["meta"] })
    shortcuts.rebind("toggleSidebar", { key: "l", modifiers: ["meta"] })

    shortcuts.reset("focusInput")

    expect(shortcuts.binding("focusInput")).toEqual({ key: "i", modifiers: ["meta"] })
    expect(shortcuts.binding("toggleSidebar")).toEqual({ key: "l", modifiers: ["meta"] })
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) as string)).toEqual({
      toggleSidebar: { key: "l", modifiers: ["meta"] },
    })
  })

  it("restores every action when called with no argument", () => {
    shortcuts.rebind("focusInput", { key: "j", modifiers: ["meta"] })
    shortcuts.rebind("toggleSidebar", { key: "l", modifiers: ["meta"] })

    shortcuts.reset()

    expect(shortcuts.binding("focusInput")).toEqual({ key: "i", modifiers: ["meta"] })
    expect(shortcuts.binding("toggleSidebar")).toEqual({ key: "b", modifiers: ["meta"] })
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("{}")
  })

  it("is a no-op for an action that was never customised", () => {
    expect(() => shortcuts.reset("focusInput")).not.toThrow()
    expect(shortcuts.binding("focusInput")).toEqual({ key: "i", modifiers: ["meta"] })
  })
})

describe("shortcuts.isEnabled / setEnabled", () => {
  it("defaults to enabled", () => {
    expect(shortcuts.isEnabled()).toBe(true)
  })

  it("persists the off switch under its own key", () => {
    shortcuts.setEnabled(false)
    expect(window.localStorage.getItem(ENABLED_KEY)).toBe("false")
    expect(shortcuts.isEnabled()).toBe(false)

    shortcuts.setEnabled(true)
    expect(window.localStorage.getItem(ENABLED_KEY)).toBe("true")
    expect(shortcuts.isEnabled()).toBe(true)
  })

  it('treats any non-"false" stored value as enabled', () => {
    window.localStorage.setItem(ENABLED_KEY, "garbage")
    expect(shortcuts.isEnabled()).toBe(true)
  })

  it("stays enabled when localStorage is unavailable", () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {})
    const original = window.localStorage
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("blocked")
      },
    })

    expect(shortcuts.isEnabled()).toBe(true)
    expect(() => shortcuts.setEnabled(false)).not.toThrow()

    Object.defineProperty(window, "localStorage", { configurable: true, value: original })
    expect(errorSpy).toHaveBeenCalled()
    errorSpy.mockRestore()
  })
})

describe("shortcuts.importConfig — untrusted input", () => {
  it("rejects malformed JSON", () => {
    expect(shortcuts.importConfig("{not json")).toEqual({
      ok: false,
      error: "Invalid JSON format",
    })
  })

  it("rejects payloads that are not objects", () => {
    expect(shortcuts.importConfig("null").error).toBe("Invalid import format")
    expect(shortcuts.importConfig('"a string"').error).toBe("Invalid import format")
    expect(shortcuts.importConfig("42").error).toBe("Invalid import format")
  })

  it("rejects a wrapper whose shortcuts field is not an object", () => {
    expect(shortcuts.importConfig('{"version":1,"shortcuts":42}').error).toBe(
      "Invalid shortcuts data"
    )
  })

  it("accepts a bare binding map as well as the wrapped export format", () => {
    expect(shortcuts.importConfig('{"focusInput":{"key":"j","modifiers":["meta"]}}')).toEqual({
      ok: true,
      applied: 1,
    })
    expect(shortcuts.binding("focusInput")).toEqual({ key: "j", modifiers: ["meta"] })
  })

  it("drops unknown action ids without failing the import", () => {
    const result = shortcuts.importConfig(
      '{"notAnAction":{"key":"j","modifiers":["meta"]},"focusInput":{"key":"j","modifiers":["meta"]}}'
    )

    expect(result).toEqual({ ok: true, applied: 1 })
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) as string)).toEqual({
      focusInput: { key: "j", modifiers: ["meta"] },
    })
  })

  it("does not treat inherited object keys as known actions", () => {
    const result = shortcuts.importConfig('{"__proto__":{"key":"j","modifiers":["meta"]}}')

    expect(result).toEqual({ ok: true, applied: 0 })
    expect(shortcuts.binding("focusInput")).toEqual({ key: "i", modifiers: ["meta"] })
    expect(({} as Record<string, unknown>).key).toBeUndefined()
  })

  it("drops entries whose binding is the wrong shape", () => {
    const result = shortcuts.importConfig(
      JSON.stringify({
        shortcuts: {
          focusInput: { key: 5, modifiers: ["meta"] },
          toggleSidebar: { key: "j" },
          settings: null,
          toggleTheme: "Cmd+J",
        },
      })
    )

    expect(result).toEqual({ ok: true, applied: 0 })
  })

  it("drops entries that fail binding validation", () => {
    const result = shortcuts.importConfig(
      JSON.stringify({
        shortcuts: {
          focusInput: { key: "j", modifiers: [] },
          toggleSidebar: { key: "F5", modifiers: ["meta"] },
          settings: { key: "j", modifiers: ["meta"] },
        },
      })
    )

    expect(result).toEqual({ ok: true, applied: 1 })
    expect(shortcuts.binding("settings")).toEqual({ key: "j", modifiers: ["meta"] })
    expect(shortcuts.binding("focusInput")).toEqual({ key: "i", modifiers: ["meta"] })
  })

  it("accepts conflicting bindings — import does not enforce uniqueness", () => {
    const result = shortcuts.importConfig(
      JSON.stringify({
        shortcuts: {
          focusInput: { key: "j", modifiers: ["meta"] },
          toggleSidebar: { key: "j", modifiers: ["meta"] },
        },
      })
    )

    expect(result).toEqual({ ok: true, applied: 2 })
    // Both are bound; resolution falls to catalogue order.
    expect(shortcuts.resolve(keydown("j", { meta: true }))).toBe("toggleSidebar")
  })

  it("replaces existing customisations rather than merging into them", () => {
    shortcuts.rebind("focusInput", { key: "j", modifiers: ["meta"] })

    expect(shortcuts.importConfig("{}")).toEqual({ ok: true, applied: 0 })
    expect(shortcuts.binding("focusInput")).toEqual({ key: "i", modifiers: ["meta"] })
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("{}")
  })
})

describe("shortcuts.exportConfig", () => {
  it("writes a versioned document with a timestamp", () => {
    shortcuts.rebind("focusInput", { key: "j", modifiers: ["meta"] })
    const parsed = JSON.parse(shortcuts.exportConfig())

    expect(parsed.version).toBe(1)
    expect(parsed.shortcuts).toEqual({ focusInput: { key: "j", modifiers: ["meta"] } })
    expect(typeof parsed.exportedAt).toBe("string")
    expect(Number.isNaN(Date.parse(parsed.exportedAt))).toBe(false)
  })

  it("round-trips through importConfig", () => {
    shortcuts.rebind("focusInput", { key: "j", modifiers: ["meta"] })
    shortcuts.rebind("toggleSidebar", { key: "l", modifiers: ["meta", "shift"] })
    const exported = shortcuts.exportConfig()

    shortcuts.reset()
    expect(shortcuts.binding("focusInput")).toEqual({ key: "i", modifiers: ["meta"] })

    expect(shortcuts.importConfig(exported)).toEqual({ ok: true, applied: 2 })
    expect(shortcuts.binding("focusInput")).toEqual({ key: "j", modifiers: ["meta"] })
    expect(shortcuts.binding("toggleSidebar")).toEqual({ key: "l", modifiers: ["meta", "shift"] })
    expect(shortcuts.resolve(keydown("j", { meta: true }))).toBe("focusInput")
  })

  it("exports an empty map when nothing is customised", () => {
    expect(JSON.parse(shortcuts.exportConfig()).shortcuts).toEqual({})
  })
})

describe("shortcuts.reload — persisted bindings", () => {
  it("picks up bindings written to storage by another tab", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ focusInput: { key: "j", modifiers: ["meta"] } })
    )
    shortcuts.reload()

    expect(shortcuts.binding("focusInput")).toEqual({ key: "j", modifiers: ["meta"] })
  })

  it("ignores stored entries for unknown actions or malformed bindings", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        notAnAction: { key: "j", modifiers: ["meta"] },
        focusInput: { key: "j" },
        toggleSidebar: { key: "l", modifiers: ["meta"] },
      })
    )
    shortcuts.reload()

    expect(shortcuts.binding("focusInput")).toEqual({ key: "i", modifiers: ["meta"] })
    expect(shortcuts.binding("toggleSidebar")).toEqual({ key: "l", modifiers: ["meta"] })
  })

  it("falls back to defaults when storage holds junk", () => {
    window.localStorage.setItem(STORAGE_KEY, "not json at all")
    shortcuts.reload()
    expect(shortcuts.binding("focusInput")).toEqual({ key: "i", modifiers: ["meta"] })

    window.localStorage.setItem(STORAGE_KEY, '"a string"')
    shortcuts.reload()
    expect(shortcuts.binding("focusInput")).toEqual({ key: "i", modifiers: ["meta"] })
  })
})
