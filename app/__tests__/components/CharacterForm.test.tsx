import React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"

import { CharacterForm } from "@/app/components/characters/CharacterForm"

const pushMock = jest.fn()
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}))

jest.mock("@/app/hooks/useCsrfToken", () => ({
  useCsrfToken: () => ({ token: "test-csrf" }),
}))

jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
}))

// The Cloudinary widget is loaded with next/dynamic; stub it so the test does not
// depend on NEXT_PUBLIC_CLOUDINARY_* being present.
jest.mock("next/dynamic", () => ({
  __esModule: true,
  default: () =>
    function UploadStub({ children }: { children: React.ReactNode }) {
      return <button type="button">{children}</button>
    },
}))

function mockFetchOk(body: Record<string, unknown>) {
  const fetchMock = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => body,
  })
  global.fetch = fetchMock as unknown as typeof fetch
  return fetchMock
}

describe("CharacterForm", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("groups the fields into Identity, Voice, World and Publish", () => {
    render(<CharacterForm mode="create" />)

    for (const section of ["Identity", "Voice", "World", "Publish"]) {
      expect(screen.getByRole("heading", { name: section })).toBeInTheDocument()
    }
    expect(screen.getByLabelText(/Personality & rules/)).toBeInTheDocument()
    expect(screen.queryByText(/System Prompt/)).not.toBeInTheDocument()
    // Placeholders are not substituted by character-prompt.ts, so they are not advertised.
    expect(screen.queryByText(/\{\{char\}\}/)).not.toBeInTheDocument()
  })

  it("fills the personality template only when the field is empty", () => {
    render(<CharacterForm mode="create" />)

    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "Nova" } })
    const start = screen.getByRole("button", { name: "Start from example" })
    expect(start).toBeEnabled()

    fireEvent.click(start)
    const prompt = screen.getByLabelText(/Personality & rules/) as HTMLTextAreaElement
    expect(prompt.value).toMatch(/^You are Nova, /)
    expect(screen.getByRole("button", { name: "Start from example" })).toBeDisabled()
  })

  it("turns typed tags into chips and submits them as an array", async () => {
    const fetchMock = mockFetchOk({ slug: "nova", name: "Nova" })
    render(<CharacterForm mode="create" />)

    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "Nova" } })
    fireEvent.change(screen.getByLabelText(/Personality & rules/), {
      target: { value: "You are Nova, a storyteller who never breaks character." },
    })

    const tagInput = screen.getByLabelText("Add a tag")
    fireEvent.change(tagInput, { target: { value: "fantasy" } })
    fireEvent.keyDown(tagInput, { key: "Enter" })
    fireEvent.change(tagInput, { target: { value: "mentor" } })
    fireEvent.keyDown(tagInput, { key: "," })
    fireEvent.change(tagInput, { target: { value: "slow burn" } })
    fireEvent.keyDown(tagInput, { key: "Enter" })

    // Backspace on an empty draft removes the last chip; the x button removes a named one.
    fireEvent.keyDown(tagInput, { key: "Backspace" })
    fireEvent.click(screen.getByRole("button", { name: "Remove tag mentor" }))

    expect(screen.queryByRole("button", { name: "Remove tag slow burn" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Remove tag fantasy" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Create character" }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("/api/characters")
    expect(init.method).toBe("POST")
    const body = JSON.parse(init.body)
    expect(body.tags).toEqual(["fantasy"])
    expect(body.name).toBe("Nova")
    expect(body.isPublic).toBe(false)
    expect(body.isNsfw).toBe(false)
    expect(body.category).toBe("general")
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/characters/nova"))
  })

  it("previews the card from the current values", () => {
    render(<CharacterForm mode="create" />)
    const preview = screen.getByRole("complementary", { name: "Card preview" })
    expect(preview).toHaveTextContent("Your character")

    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "Nova" } })
    fireEvent.change(screen.getByLabelText(/^Tagline/), {
      target: { value: "Reads the sky" },
    })
    expect(preview).toHaveTextContent("Nova")
    expect(preview).toHaveTextContent("Reads the sky")
  })

  it("confirms deletion in a dialog that names the character", async () => {
    const fetchMock = mockFetchOk({ success: true })
    render(
      <CharacterForm
        mode="edit"
        initial={{
          id: "11111111-1111-4111-8111-111111111111",
          slug: "nova",
          name: "Nova",
          systemPrompt: "You are Nova, a storyteller.",
          tags: ["fantasy"],
        }}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Delete character" }))

    const dialog = await screen.findByRole("alertdialog")
    expect(dialog).toHaveTextContent("Delete Nova?")
    expect(dialog).toHaveTextContent(/Chats people already have with Nova will stay/)
    expect(fetchMock).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: "Delete Nova" }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("/api/characters/11111111-1111-4111-8111-111111111111")
    expect(init.method).toBe("DELETE")
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/dashboard/characters"))
  })
})
