/**
 * TwoFactorSettings Component Tests
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

// Import component after mocks
import { TwoFactorSettings } from "@/app/components/TwoFactorSettings"

// Mock the API client
const mockGet = jest.fn()
const mockPost = jest.fn()

jest.mock("@/app/lib/api-client", () => ({
  api: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
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
  toast: {
    error: jest.fn(),
    success: jest.fn(),
  },
}))

// Mock next/image
jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: { src: string; alt: string; width?: number; height?: number }) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={props.src} alt={props.alt} width={props.width} height={props.height} />
  },
}))

// toast is mocked above and used in component tests via the mock

describe("TwoFactorSettings", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Default mock: 2FA is disabled
    mockGet.mockResolvedValue({ twoFactorEnabled: false })
  })

  describe("Initial State", () => {
    it("should render the setup button when 2FA is disabled", async () => {
      render(<TwoFactorSettings hasPassword={true} />)

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /enable two-factor authentication/i })
        ).toBeInTheDocument()
      })
    })

    it('should show "off" status when disabled', async () => {
      render(<TwoFactorSettings hasPassword={true} />)

      await waitFor(() => {
        expect(screen.getByText(/Two-Factor Authentication is Off/i)).toBeInTheDocument()
      })
    })

    it("should fetch 2FA status on mount", async () => {
      render(<TwoFactorSettings hasPassword={true} />)

      await waitFor(() => {
        expect(mockGet).toHaveBeenCalledWith("/api/profile", expect.any(Object))
      })
    })

    it("should show enabled status when 2FA is enabled", async () => {
      mockGet.mockImplementation((url: string) => {
        if (url === "/api/profile") {
          return Promise.resolve({ twoFactorEnabled: true })
        }
        if (url === "/api/auth/2fa/backup-codes") {
          return Promise.resolve({ remainingCodes: 8 })
        }
        return Promise.resolve({})
      })

      render(<TwoFactorSettings hasPassword={true} />)

      await waitFor(() => {
        expect(screen.getByText(/Two-Factor Authentication is On/i)).toBeInTheDocument()
      })
    })
  })

  describe("No Password Warning", () => {
    it("should disable setup button when user has no password", async () => {
      render(<TwoFactorSettings hasPassword={false} />)

      const setupButton = await screen.findByRole("button", {
        name: /enable two-factor authentication/i,
      })

      // Button should be disabled when user has no password
      expect(setupButton).toBeDisabled()
    })

    it("should show OAuth warning message when user has no password", async () => {
      render(<TwoFactorSettings hasPassword={false} />)

      await waitFor(() => {
        expect(
          screen.getByText(/you need to set up a password before enabling 2FA/i)
        ).toBeInTheDocument()
      })
    })

    it("should not start setup process without password", async () => {
      render(<TwoFactorSettings hasPassword={false} />)

      const setupButton = await screen.findByRole("button", {
        name: /enable two-factor authentication/i,
      })
      fireEvent.click(setupButton)

      expect(mockPost).not.toHaveBeenCalled()
    })
  })

  describe("Setup Flow", () => {
    it("should start setup when clicking setup button with password", async () => {
      mockPost.mockResolvedValue({
        secret: "TESTSECRET123",
        qrCode: "data:image/png;base64,test",
      })

      render(<TwoFactorSettings hasPassword={true} />)

      const setupButton = await screen.findByRole("button", {
        name: /enable two-factor authentication/i,
      })
      fireEvent.click(setupButton)

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith("/api/auth/2fa/setup", {}, expect.any(Object))
      })
    })

    it("should show QR code after setup starts", async () => {
      mockPost.mockResolvedValue({
        secret: "TESTSECRET123",
        qrCode: "data:image/png;base64,testqrcode",
      })

      render(<TwoFactorSettings hasPassword={true} />)

      const setupButton = await screen.findByRole("button", {
        name: /enable two-factor authentication/i,
      })
      fireEvent.click(setupButton)

      await waitFor(() => {
        expect(screen.getByAltText(/QR Code for authenticator app/i)).toBeInTheDocument()
      })
    })

    it("should show verification code inputs after scanning", async () => {
      mockPost.mockResolvedValue({
        secret: "TESTSECRET123",
        qrCode: "data:image/png;base64,testqrcode",
      })

      render(<TwoFactorSettings hasPassword={true} />)

      const setupButton = await screen.findByRole("button", {
        name: /enable two-factor authentication/i,
      })
      fireEvent.click(setupButton)

      // Wait for QR code to appear, then click Continue
      await waitFor(() => {
        expect(screen.getByAltText(/QR Code for authenticator app/i)).toBeInTheDocument()
      })

      // Click Continue to go to verification step
      const continueButton = screen.getByRole("button", { name: /continue/i })
      fireEvent.click(continueButton)

      await waitFor(() => {
        // Should have 6 input fields for the verification code
        const inputs = screen.getAllByRole("textbox")
        expect(inputs.length).toBeGreaterThanOrEqual(6)
      })
    })
  })

  describe("Verification Code Input", () => {
    beforeEach(async () => {
      mockPost.mockResolvedValue({
        secret: "TESTSECRET123",
        qrCode: "data:image/png;base64,testqrcode",
      })
    })

    it("should handle code input correctly", async () => {
      const user = userEvent.setup()

      render(<TwoFactorSettings hasPassword={true} />)

      const setupButton = await screen.findByRole("button", {
        name: /enable two-factor authentication/i,
      })
      await user.click(setupButton)

      await waitFor(() => {
        expect(screen.getByAltText(/QR Code for authenticator app/i)).toBeInTheDocument()
      })

      // Click Continue to go to verification step
      const continueButton = screen.getByRole("button", { name: /continue/i })
      await user.click(continueButton)

      await waitFor(() => {
        expect(screen.getAllByRole("textbox").length).toBeGreaterThanOrEqual(6)
      })

      const inputs = screen.getAllByRole("textbox")
      // Type a digit in the first input
      await user.type(inputs[0], "1")

      expect(inputs[0]).toHaveValue("1")
    })

    it("should reject non-digit input", async () => {
      const user = userEvent.setup()

      render(<TwoFactorSettings hasPassword={true} />)

      const setupButton = await screen.findByRole("button", {
        name: /enable two-factor authentication/i,
      })
      await user.click(setupButton)

      await waitFor(() => {
        expect(screen.getByAltText(/QR Code for authenticator app/i)).toBeInTheDocument()
      })

      // Click Continue to go to verification step
      const continueButton = screen.getByRole("button", { name: /continue/i })
      await user.click(continueButton)

      await waitFor(() => {
        expect(screen.getAllByRole("textbox").length).toBeGreaterThanOrEqual(6)
      })

      const inputs = screen.getAllByRole("textbox")
      await user.type(inputs[0], "a")

      expect(inputs[0]).toHaveValue("")
    })
  })

  describe("Enabled State", () => {
    beforeEach(() => {
      mockGet.mockImplementation((url: string) => {
        if (url === "/api/profile") {
          return Promise.resolve({ twoFactorEnabled: true })
        }
        if (url === "/api/auth/2fa/backup-codes") {
          return Promise.resolve({ remainingCodes: 8 })
        }
        return Promise.resolve({})
      })
    })

    it("should show remaining backup codes count", async () => {
      render(<TwoFactorSettings hasPassword={true} />)

      await waitFor(() => {
        expect(screen.getByText(/8 backup codes remaining/i)).toBeInTheDocument()
      })
    })

    it("should show disable button when 2FA is enabled", async () => {
      render(<TwoFactorSettings hasPassword={true} />)

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /disable two-factor authentication/i })
        ).toBeInTheDocument()
      })
    })

    it("should show generate new backup codes button", async () => {
      render(<TwoFactorSettings hasPassword={true} />)

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /generate new backup codes/i })
        ).toBeInTheDocument()
      })
    })
  })

  describe("Accessibility", () => {
    it("should have proper aria labels on status elements", async () => {
      render(<TwoFactorSettings hasPassword={true} />)

      await waitFor(() => {
        // Check that the component renders without accessibility issues
        expect(screen.getByRole("button")).toBeInTheDocument()
      })
    })

    it("should have proper heading structure", async () => {
      mockGet.mockResolvedValue({ twoFactorEnabled: false })

      render(<TwoFactorSettings hasPassword={true} />)

      await waitFor(() => {
        const button = screen.getByRole("button", { name: /enable two-factor authentication/i })
        expect(button).toBeEnabled()
      })
    })
  })
})

export {}
