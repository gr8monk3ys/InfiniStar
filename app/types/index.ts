import { Conversation, Message, User } from "@prisma/client";
import { Icons } from "@/app/components/icons";

export type FullMessageType = Message & {
  sender: User;
  seen: User[];
  body: string;
  image?: string;
  seenIds?: string[];
};

export type FullConversationType = Conversation & {
  user: User[];
  messages: FullMessageType[];
  title?: string;
  isGroup: boolean;
  userIds?: string[];
  lastMessageAt?: Date;
};

export type IParams = {
  conversationId: string;
  userId?: string;
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  secondary?: boolean;
  danger?: boolean;
}

export interface SelectProps {
  disabled?: boolean;
  label?: string;
  options: { value: string; label: string | null }[];
  onChange: (value: any) => void;
  value?: any;
}

export interface DashboardConfig {
  mainNav: {
    title: string;
    href: string;
  }[];
  sidebarNav: {
    title: string;
    href: string;
    icon: keyof typeof Icons;
  }[];
}

export interface SubscriptionPlan {
  name: string;
  description: string;
  stripePriceId: string;
  price: number;
  features: string[];
}
