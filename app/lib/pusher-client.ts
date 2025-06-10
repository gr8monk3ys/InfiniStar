import PusherClient from "pusher-js"

let _pusherClient: PusherClient | undefined

export const pusherClient = new Proxy({} as PusherClient, {
  get(_target, prop, receiver) {
    if (!_pusherClient) {
      const key = process.env.NEXT_PUBLIC_PUSHER_APP_KEY
      if (!key) {
        throw new Error("Missing NEXT_PUBLIC_PUSHER_APP_KEY environment variable")
      }
      _pusherClient = new PusherClient(key, {
        channelAuthorization: {
          endpoint: "/api/pusher/auth",
          transport: "ajax",
        },
        cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "us2",
      })
    }
    const value = Reflect.get(_pusherClient, prop, receiver)
    return typeof value === "function" ? value.bind(_pusherClient) : value
  },
})
