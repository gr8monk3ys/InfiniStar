/**
 * SessionsList Component Tests
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react"

// Import component after mocks
import SessionsList from "@/app/components/SessionsList"
import type { UserSessionInfo } from "@/app/types"

// Mock the API client
const mockGet = jest.fn()
const mockPost = jest.fn()
const mockDelete = jest.fn()

jest.mock("@/app/lib/api-client", () => ({
  api: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
  ApiError: class ApiError extends Error {
    constructor(message: string) {
      super(message)
      this.name = "ApiError"
    }
  },
  createLoadingToast: () => ({
    dismiss: jest.fn(),
    error: jest.fn(),
    success: jest.fn(),
  }),
}))

// Mock react-hot-toast
jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    success: jest.fn(),
  },
}))

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}
Object.defineProperty(window, "localStorage", { value: localStorageMock })

// Sample session data - matches UserSessionInfo interface
const mockSessions: UserSessionInfo[] = [
  {
    id: "session-1",
    browser: "Chrome",
    os: "macOS",
    deviceType: "desktop",
    ipAddress: "192.168.x.x",
    lastActiveAt: new Date(),
    createdAt: new Date(),
    isCurrentSession: true,
  },
  {
    id: "session-2",
    browser: "Firefox",
    os: "Windows 11",
    deviceType: "desktop",
    ipAddress: "10.0.x.x",
    lastActiveAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    isCurrentSession: false,
  },
  {
    id: "session-3",
    browser: "Safari",
    os: "iOS",
    deviceType: "mobile",
    ipAddress: "172.16.x.x",
    lastActiveAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    isCurrentSession: false,
  },
]

describe("SessionsList", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    localStorageMock.getItem.mockReturnValue("current-token")
  })

  describe("Loading State", () => {
    it("should show loading spinner initially", () => {
      mockGet.mockImplementation(() => new Promise(() => {})) // Never resolves

      render(<SessionsList />)

      expect(screen.getByText(/loading sessions/i)).toBeInTheDocument()
    })
  })

  describe("Sessions Display", () => {
    beforeEach(() => {
      mockGet.mockResolvedValue({ sessions: mockSessions })
    })

    it("should display all sessions after loading", async () => {
      render(<SessionsList />)

      await waitFor(() => {
        expect(screen.getByText("Chrome")).toBeInTheDocument()
        expect(screen.getByText("Firefox")).toBeInTheDocument()
        expect(screen.getByText("Safari")).toBeInTheDocument()
      })
    })

    it('should show "Current session" badge for current session', async () => {
      render(<SessionsList />)

      await waitFor(() => {
        expect(screen.getByText("Current session")).toBeInTheDocument()
      })
    })

    it("should display operating system information", async () => {
      render(<SessionsList />)

      await waitFor(() => {
        expect(screen.getByText("macOS")).toBeInTheDocument()
        expect(screen.getByText("Windows 11")).toBeInTheDocument()
        expect(screen.getByText("iOS")).toBeInTheDocument()
      })
    })

    it("should display IP addresses", async () => {
      render(<SessionsList />)

      await waitFor(() => {
        expect(screen.getByText(/IP: 192\.168\.x\.x/)).toBeInTheDocument()
        expect(screen.getByText(/IP: 10\.0\.x\.x/)).toBeInTheDocument()
      })
    })

    it("should format relative times correctly", async () => {
      render(<SessionsList />)

      await waitFor(() => {
        // Current session should show "Just now" or recent time
        // Multiple sessions have "Active" text, so we check for at least one
        const activeTexts = screen.getAllByText(/Active/)
        expect(activeTexts.length).toBeGreaterThan(0)
      })
    })
  })

  describe("Device Icons", () => {
    beforeEach(() => {
      mockGet.mockResolvedValue({ sessions: mockSessions })
    })

    it("should render device icons based on device type", async () => {
      render(<SessionsList />)

      await waitFor(() => {
        // Component should render without errors with device icons
        expect(screen.getAllByRole("listitem")).toHaveLength(3)
      })
    })
  })

  describe("Session Revocation", () => {
    beforeEach(() => {
      mockGet.mockResolvedValue({ sessions: mockSessions })
      mockDelete.mockResolvedValue({ success: true, message: "Session revoked" })
    })

    it("should show revoke buttons for non-current sessions", async () => {
      render(<SessionsList />)

      await waitFor(() => {
        // Should have revoke buttons for non-current sessions (aria-label includes "Revoke session from...")
        const revokeButtons = screen.getAllByRole("button", { name: /revoke session from/i })
        expect(revokeButtons.length).toBeGreaterThanOrEqual(2)
      })
    })

    it("should show confirmation dialog when clicking revoke", async () => {
      render(<SessionsList />)

      await waitFor(() => {
        expect(screen.getByText("Firefox")).toBeInTheDocument()
      })

      // Find and click a revoke button (buttons have aria-label "Revoke session from...")
      const revokeButtons = screen.getAllByRole("button", { name: /revoke session from/i })
      fireEvent.click(revokeButtons[0])

      await waitFor(() => {
        expect(
          screen.getByText(/are you sure you want to revoke this session/i)
        ).toBeInTheDocument()
      })
    })

    it("should call API when confirming session revocation", async () => {
      render(<SessionsList />)

      await waitFor(() => {
        expect(screen.getByText("Firefox")).toBeInTheDocument()
      })

      // Click revoke on a non-current session
      const revokeButtons = screen.getAllByRole("button", { name: /revoke session from/i })
      fireEvent.click(revokeButtons[0])

      // Wait for dialog to appear
      await waitFor(() => {
        expect(
          screen.getByText(/are you sure you want to revoke this session/i)
        ).toBeInTheDocument()
      })

      // Confirm in dialog - button text is "Revoke Session"
      const confirmButton = screen.getByRole("button", { name: /^revoke session$/i })
      fireEvent.click(confirmButton)

      await waitFor(() => {
        expect(mockDelete).toHaveBeenCalled()
      })
    })
  })

  describe("Revoke All Sessions", () => {
    beforeEach(() => {
      mockGet.mockResolvedValue({ sessions: mockSessions })
      mockDelete.mockResolvedValue({ success: true, message: "All sessions revoked", count: 2 })
    })

    it('should show "Revoke all other sessions" button', async () => {
      render(<SessionsList />)

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /revoke all other sessions/i })
        ).toBeInTheDocument()
      })
    })

    it("should show confirmation dialog when clicking revoke all", async () => {
      render(<SessionsList />)

      await waitFor(() => {
        expect(screen.getByText("Chrome")).toBeInTheDocument()
      })

      const revokeAllButton = screen.getByRole("button", { name: /revoke all other sessions/i })
      fireEvent.click(revokeAllButton)

      await waitFor(() => {
        // Dialog title is "Revoke All Other Sessions"
        expect(
          screen.getByText(/are you sure you want to revoke all other sessions/i)
        ).toBeInTheDocument()
      })
    })
  })

  describe("Empty State", () => {
    it("should handle empty sessions list", async () => {
      mockGet.mockResolvedValue({ sessions: [] })

      render(<SessionsList />)

      await waitFor(() => {
        // Should not crash and might show some empty state or just one session
        expect(screen.queryByRole("listitem")).not.toBeInTheDocument()
      })
    })
  })

  describe("Error Handling", () => {
    it("should handle API error gracefully", async () => {
      mockGet.mockRejectedValue(new Error("Failed to fetch sessions"))

      render(<SessionsList />)

      // Should not crash - loading should disappear
      await waitFor(() => {
        expect(screen.queryByText(/loading sessions/i)).not.toBeInTheDocument()
      })
    })
  })

  describe("Accessibility", () => {
    beforeEach(() => {
      mockGet.mockResolvedValue({ sessions: mockSessions })
    })

    it("should have proper list structure", async () => {
      render(<SessionsList />)

      await waitFor(() => {
        const listItems = screen.getAllByRole("listitem")
        expect(listItems.length).toBe(3)
      })
    })

    it("should have proper button labels", async () => {
      render(<SessionsList />)

      await waitFor(() => {
        // Individual revoke buttons have descriptive aria-labels
        const revokeButtons = screen.getAllByRole("button", { name: /revoke session from/i })
        expect(revokeButtons.length).toBeGreaterThan(0)
      })
    })
  })
})

export {}
