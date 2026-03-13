import PusherServer from "pusher"
import PusherClient from "pusher-js"

let _pusherServer: PusherServer | undefined

export const pusherServer = new Proxy({} as PusherServer, {
  get(_target, prop, receiver) {
    if (!_pusherServer) {
      const appId = process.env.PUSHER_APP_ID
      const key = process.env.NEXT_PUBLIC_PUSHER_APP_KEY
      const secret = process.env.PUSHER_SECRET
      if (!appId || !key || !secret) {
        throw new Error(
          "Missing Pusher environment variables (PUSHER_APP_ID, NEXT_PUBLIC_PUSHER_APP_KEY, PUSHER_SECRET)"
        )
      }
      _pusherServer = new PusherServer({
        appId,
        key,
        secret,
        cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "us2",
        useTLS: true,
      })
    }
    const value = Reflect.get(_pusherServer, prop, receiver)
    return typeof value === "function" ? value.bind(_pusherServer) : value
  },
})

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
