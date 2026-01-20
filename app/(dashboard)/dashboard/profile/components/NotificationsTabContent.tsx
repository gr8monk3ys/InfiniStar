"use client"

interface NotificationsTabContentProps {
  emailNotifications: boolean
  setEmailNotifications: (value: boolean) => void
  emailDigest: "none" | "daily" | "weekly"
  setEmailDigest: (value: "none" | "daily" | "weekly") => void
  notifyOnNewMessage: boolean
  setNotifyOnNewMessage: (value: boolean) => void
  notifyOnMention: boolean
  setNotifyOnMention: (value: boolean) => void
  notifyOnAIComplete: boolean
  setNotifyOnAIComplete: (value: boolean) => void
  isLoading: boolean
  onSubmit: (e: React.FormEvent) => void
}

export function NotificationsTabContent({
  emailNotifications,
  setEmailNotifications,
  emailDigest,
  setEmailDigest,
  notifyOnNewMessage,
  setNotifyOnNewMessage,
  notifyOnMention,
  setNotifyOnMention,
  notifyOnAIComplete,
  setNotifyOnAIComplete,
  isLoading,
  onSubmit,
}: NotificationsTabContentProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-6" aria-label="Notification preferences form">
      <div>
        <h3 className="text-lg font-medium text-gray-900">Notification Preferences</h3>
        <p className="mt-1 text-sm text-gray-600">
          Control how and when you receive notifications from InfiniStar.
        </p>
      </div>

      {/* Email Notifications Master Toggle */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <label htmlFor="emailNotifications" className="block text-sm font-medium text-gray-900">
              Email Notifications
            </label>
            <p className="mt-1 text-sm text-gray-500">
              Receive email notifications for important updates and messages.
            </p>
          </div>
          <button
            type="button"
            id="emailNotifications"
            role="switch"
            aria-checked={emailNotifications}
            onClick={() => setEmailNotifications(!emailNotifications)}
            disabled={isLoading}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
              emailNotifications ? "bg-sky-600" : "bg-gray-200"
            }`}
          >
            <span className="sr-only">Enable email notifications</span>
            <span
              className={`pointer-events-none inline-block size-5 rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                emailNotifications ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Email Digest Frequency */}
      <div>
        <label htmlFor="emailDigest" className="block text-sm font-medium text-gray-700">
          Email Digest Frequency
        </label>
        <p className="mt-1 text-sm text-gray-500">
          Receive a summary of your activity and conversations.
        </p>
        <select
          id="emailDigest"
          value={emailDigest}
          onChange={(e) => setEmailDigest(e.target.value as "none" | "daily" | "weekly")}
          disabled={isLoading || !emailNotifications}
          className="mt-2 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
        >
          <option value="none">No digest</option>
          <option value="daily">Daily summary</option>
          <option value="weekly">Weekly summary</option>
        </select>
      </div>

      {/* Notification Type Toggles */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-gray-900">Notification Types</h4>

        {/* New Message Notifications */}
        <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
          <div className="flex-1">
            <label htmlFor="notifyOnNewMessage" className="block text-sm font-medium text-gray-700">
              New Messages
            </label>
            <p className="mt-1 text-sm text-gray-500">
              Get notified when you receive a new message in a conversation.
            </p>
          </div>
          <button
            type="button"
            id="notifyOnNewMessage"
            role="switch"
            aria-checked={notifyOnNewMessage}
            onClick={() => setNotifyOnNewMessage(!notifyOnNewMessage)}
            disabled={isLoading || !emailNotifications}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
              notifyOnNewMessage && emailNotifications ? "bg-sky-600" : "bg-gray-200"
            }`}
          >
            <span className="sr-only">Enable new message notifications</span>
            <span
              className={`pointer-events-none inline-block size-5 rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                notifyOnNewMessage && emailNotifications ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Mention Notifications */}
        <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
          <div className="flex-1">
            <label htmlFor="notifyOnMention" className="block text-sm font-medium text-gray-700">
              Mentions
            </label>
            <p className="mt-1 text-sm text-gray-500">
              Get notified when someone mentions you in a conversation.
            </p>
          </div>
          <button
            type="button"
            id="notifyOnMention"
            role="switch"
            aria-checked={notifyOnMention}
            onClick={() => setNotifyOnMention(!notifyOnMention)}
            disabled={isLoading || !emailNotifications}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
              notifyOnMention && emailNotifications ? "bg-sky-600" : "bg-gray-200"
            }`}
          >
            <span className="sr-only">Enable mention notifications</span>
            <span
              className={`pointer-events-none inline-block size-5 rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                notifyOnMention && emailNotifications ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* AI Response Notifications */}
        <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
          <div className="flex-1">
            <label htmlFor="notifyOnAIComplete" className="block text-sm font-medium text-gray-700">
              AI Response Complete
            </label>
            <p className="mt-1 text-sm text-gray-500">
              Get notified when an AI assistant has finished generating a response.
            </p>
          </div>
          <button
            type="button"
            id="notifyOnAIComplete"
            role="switch"
            aria-checked={notifyOnAIComplete}
            onClick={() => setNotifyOnAIComplete(!notifyOnAIComplete)}
            disabled={isLoading || !emailNotifications}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
              notifyOnAIComplete && emailNotifications ? "bg-sky-600" : "bg-gray-200"
            }`}
          >
            <span className="sr-only">Enable AI response notifications</span>
            <span
              className={`pointer-events-none inline-block size-5 rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                notifyOnAIComplete && emailNotifications ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Muted Conversations Info */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <h4 className="text-sm font-medium text-gray-900">Muted Conversations</h4>
        <p className="mt-1 text-sm text-gray-500">
          You can mute individual conversations to stop receiving notifications from them. To mute a
          conversation, open it and click the mute button in the conversation settings.
        </p>
      </div>

      {/* Submit Button */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isLoading}
          aria-busy={isLoading}
          className="rounded-md bg-sky-600 px-4 py-2 text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? "Saving..." : "Save Preferences"}
        </button>
      </div>
    </form>
  )
}
