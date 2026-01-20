import crypto from "crypto"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import bcrypt from "bcrypt"
import { type AuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import GithubProvider from "next-auth/providers/github"
import GoogleProvider from "next-auth/providers/google"

import prisma from "@/app/lib/prismadb"
import {
  decryptSecret,
  parseBackupCode,
  verifyBackupCode,
  verifyTOTPCode,
} from "@/app/lib/two-factor"

/**
 * In-memory store for 2FA login tokens
 * In production, use Redis or another distributed cache
 */
const twoFactorLoginTokenStore = new Map<string, { token: string; expiresAt: number }>()

// Clean up expired tokens every minute
setInterval(() => {
  const now = Date.now()
  for (const [email, data] of twoFactorLoginTokenStore.entries()) {
    if (data.expiresAt < now) {
      twoFactorLoginTokenStore.delete(email)
    }
  }
}, 60000)

/**
 * Generate a temporary token for the 2FA login flow
 */
async function generate2FALoginToken(email: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex")
  const expiresAt = Date.now() + 5 * 60 * 1000 // 5 minutes
  twoFactorLoginTokenStore.set(email.toLowerCase(), { token, expiresAt })
  return token
}

/**
 * Verify a 2FA login token
 */
export async function verify2FALoginToken(email: string, token: string): Promise<boolean> {
  const data = twoFactorLoginTokenStore.get(email.toLowerCase())
  if (!data) return false
  if (data.expiresAt < Date.now()) {
    twoFactorLoginTokenStore.delete(email.toLowerCase())
    return false
  }
  return data.token === token
}

/**
 * Clear a 2FA login token
 */
export async function clear2FALoginToken(email: string): Promise<void> {
  twoFactorLoginTokenStore.delete(email.toLowerCase())
}

/**
 * Verify a 2FA code (TOTP or backup code)
 */
async function verify2FACode(
  code: string,
  encryptedSecret: string,
  hashedBackupCodes: string[],
  userId: string
): Promise<boolean> {
  // First try TOTP code (6 digits)
  if (code.length === 6 && /^\d+$/.test(code)) {
    const secret = decryptSecret(encryptedSecret)
    if (verifyTOTPCode(code, secret)) {
      return true
    }
  }

  // Try backup code
  if (hashedBackupCodes.length > 0) {
    const parsedCode = parseBackupCode(code)
    const usedIndex = verifyBackupCode(parsedCode, hashedBackupCodes)
    if (usedIndex !== -1) {
      // Remove the used backup code
      const updatedCodes = [...hashedBackupCodes]
      updatedCodes.splice(usedIndex, 1)
      await prisma.user.update({
        where: { id: userId },
        data: { twoFactorBackupCodes: updatedCodes },
      })
      return true
    }
  }

  return false
}

export const authOptions: AuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "email", type: "text" },
        password: { label: "password", type: "password" },
        twoFactorCode: { label: "twoFactorCode", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Invalid credentials")
        }

        const user = await prisma.user.findUnique({
          where: {
            email: credentials.email,
          },
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
            hashedPassword: true,
            emailVerified: true,
            twoFactorEnabled: true,
            twoFactorSecret: true,
            twoFactorBackupCodes: true,
          },
        })

        if (!user || !user?.hashedPassword) {
          throw new Error("Invalid credentials")
        }

        const isCorrectPassword = await bcrypt.compare(credentials.password, user.hashedPassword)

        if (!isCorrectPassword) {
          throw new Error("Invalid credentials")
        }

        // Check if email is verified (only for credentials login, not OAuth)
        if (!user.emailVerified) {
          throw new Error(
            "Please verify your email before logging in. Check your inbox for the verification link."
          )
        }

        // Check if 2FA is enabled
        if (user.twoFactorEnabled && user.twoFactorSecret) {
          // If no 2FA code provided, signal that 2FA is required
          if (!credentials.twoFactorCode) {
            // Generate a temporary token for the 2FA verification flow
            const twoFactorToken = await generate2FALoginToken(user.email!)
            throw new Error(`2FA_REQUIRED:${twoFactorToken}`)
          }

          // Verify the 2FA code
          const is2FAValid = await verify2FACode(
            credentials.twoFactorCode,
            user.twoFactorSecret,
            user.twoFactorBackupCodes,
            user.id
          )

          if (!is2FAValid) {
            throw new Error("Invalid two-factor authentication code")
          }
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        }
      },
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!
        session.user.email = token.email!
        session.user.name = token.name
        session.user.image = token.picture
      }
      return session
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
  },
  debug: process.env.NODE_ENV === "development",
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
}
