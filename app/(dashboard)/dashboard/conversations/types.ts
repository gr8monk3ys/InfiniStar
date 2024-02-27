export interface NotificationPreferences {
  browserNotifications: boolean
  notifyOnNewMessage: boolean
  notifyOnAIComplete: boolean
  mutedConversations: string[]
}

export interface SceneCharacterOption {
  id: string
  name: string
  tagline: string | null
  avatarUrl: string | null
}
