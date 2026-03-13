import PusherServer from "pusher"

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
