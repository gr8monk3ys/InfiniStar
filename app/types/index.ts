import {
  type Conversation,
  type ConversationShare,
  type Message,
  type MessageTemplate,
  type SharePermission,
  type ShareType,
  type Tag,
  type User,
} from "@prisma/client"

import { type Icons } from "@/app/components/icons"

export type FullMessageType = Message & {
  sender: User
  seen: User[]
  replyTo?: (Message & { sender: User }) | null
}

export type FullConversationType = Conversation & {
  users: User[]
  messages: FullMessageType[]
  tags?: Tag[]
  title?: string
  isGroup: boolean
  userIds?: string[]
  lastMessageAt?: Date
  archivedBy?: string[]
  archivedAt?: Date | null
}

/**
 * Tag Types
 */
export type TagType = Tag

export interface TagWithCount extends Tag {
  conversationCount: number
}

/**
 * Predefined tag colors with their Tailwind classes
 */
export const TAG_COLORS = {
  red: { bg: "bg-red-100", text: "text-red-700", border: "border-red-200" },
  orange: { bg: "bg-orange-100", text: "text-orange-700", border: "border-orange-200" },
  yellow: { bg: "bg-yellow-100", text: "text-yellow-700", border: "border-yellow-200" },
  green: { bg: "bg-green-100", text: "text-green-700", border: "border-green-200" },
  teal: { bg: "bg-teal-100", text: "text-teal-700", border: "border-teal-200" },
  blue: { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-200" },
  purple: { bg: "bg-purple-100", text: "text-purple-700", border: "border-purple-200" },
  pink: { bg: "bg-pink-100", text: "text-pink-700", border: "border-pink-200" },
  gray: { bg: "bg-gray-100", text: "text-gray-700", border: "border-gray-200" },
  indigo: { bg: "bg-indigo-100", text: "text-indigo-700", border: "border-indigo-200" },
} as const

export type TagColor = keyof typeof TAG_COLORS

export type IParams = {
  conversationId: string
  userId?: string
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  secondary?: boolean
  danger?: boolean
}

export interface SelectOption {
  value: string
  label: string | null
}

export interface SelectProps {
  disabled?: boolean
  label?: string
  options: SelectOption[]
  onChange: (value: SelectOption[]) => void
  value?: SelectOption[]
}

export interface DashboardConfig {
  mainNav: {
    title: string
    href: string
  }[]
  sidebarNav: {
    title: string
    href: string
    icon: keyof typeof Icons
  }[]
}

export interface SubscriptionPlan {
  name: string
  description: string
  stripePriceId: string
  price: number
  features: string[]
}

export type UserSubscriptionPlan = SubscriptionPlan &
  Pick<User, "stripeCustomerId" | "stripeSubscriptionId"> & {
    stripeCurrentPeriodEnd: number
    isPro: boolean
  }

/**
 * Session Management Types
 */
export interface UserSessionInfo {
  id: string
  deviceType: string | null
  browser: string | null
  os: string | null
  ipAddress: string // Masked IP address
  createdAt: Date
  lastActiveAt: Date
  isCurrentSession: boolean
}

export interface SessionsResponse {
  sessions: UserSessionInfo[]
  currentSessionToken: string | null
}

/**
 * Message Template Types
 */
export type MessageTemplateType = MessageTemplate

export interface MessageTemplateWithUsage extends MessageTemplate {
  isPopular?: boolean // Flag for frequently used templates
}

/**
 * Predefined template categories
 */
export const TEMPLATE_CATEGORIES = [
  "Greetings",
  "Business",
  "Personal",
  "Support",
  "Follow-up",
  "Other",
] as const

export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number]

/**
 * Template limits based on subscription
 */
export const TEMPLATE_LIMITS = {
  FREE: 20,
  PRO: 100,
} as const

/**
 * Template content constraints
 */
export const TEMPLATE_CONSTRAINTS = {
  NAME_MIN_LENGTH: 1,
  NAME_MAX_LENGTH: 50,
  CONTENT_MIN_LENGTH: 1,
  CONTENT_MAX_LENGTH: 2000,
  SHORTCUT_MIN_LENGTH: 2,
  SHORTCUT_MAX_LENGTH: 20,
  CATEGORY_MAX_LENGTH: 30,
} as const

/**
 * Template shortcut validation pattern
 * Must start with "/" and contain only alphanumeric characters, hyphens, and underscores
 */
export const TEMPLATE_SHORTCUT_PATTERN = /^\/[a-zA-Z0-9_-]+$/

/**
 * Variable placeholder pattern for template content
 * Matches {{variableName}} patterns
 */
export const TEMPLATE_VARIABLE_PATTERN = /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g

/**
 * Template variable types for placeholder replacement
 */
export interface TemplateVariables {
  name?: string
  date?: string
  time?: string
  [key: string]: string | undefined
}

/**
 * Response types for template API endpoints
 */
export interface TemplatesResponse {
  templates: MessageTemplateType[]
  total: number
}

export interface TemplateResponse {
  template: MessageTemplateType
}

export interface TemplateUsageResponse {
  template: MessageTemplateType
  content: string // Processed content with variables replaced
}

/**
 * Conversation Share Types
 */
export type ConversationShareType = ConversationShare

export interface ConversationShareWithUrl extends ConversationShare {
  shareUrl: string
}

export interface SharePublicInfo {
  id: string
  conversationId: string
  conversationName: string | null
  messageCount: number
  participantCount: number
  permission: SharePermission
  shareType: ShareType
  isExpired: boolean
  isMaxUsesReached: boolean
  isActive: boolean
  createdAt: Date
  expiresAt: Date | null
}

export interface CreateShareRequest {
  shareType?: ShareType
  permission?: SharePermission
  expiresAt?: string | null
  maxUses?: number | null
  allowedEmails?: string[]
  name?: string | null
}

export interface UpdateShareRequest {
  permission?: SharePermission
  expiresAt?: string | null
  maxUses?: number | null
  allowedEmails?: string[]
  name?: string | null
  isActive?: boolean
}

export interface ShareResponse {
  share: ConversationShareWithUrl
  shareUrl: string
}

export interface SharesListResponse {
  shares: ConversationShareWithUrl[]
}

export interface JoinShareResponse {
  success: boolean
  conversationId: string
  permission: SharePermission
  conversation?: FullConversationType
}

export { type SharePermission, type ShareType }
