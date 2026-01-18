import { type Conversation, type Message, type User } from "@prisma/client"

import { type Icons } from "@/app/components/icons"

export type FullMessageType = Message & {
  sender: User
  seen: User[]
  replyTo?: (Message & { sender: User }) | null
}

export type FullConversationType = Conversation & {
  users: User[]
  messages: FullMessageType[]
  title?: string
  isGroup: boolean
  userIds?: string[]
  lastMessageAt?: Date
  archivedBy?: string[]
  archivedAt?: Date | null
}

export type IParams = {
  conversationId: string
  userId?: string
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  secondary?: boolean
  danger?: boolean
}

export interface SelectProps {
  disabled?: boolean
  label?: string
  options: { value: string; label: string | null }[]
  onChange: (value: any) => void
  value?: any
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
