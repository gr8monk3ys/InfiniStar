import pino from "pino"

const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === "production" ? "info" : "debug"),
  formatters: {
    level(label: string) {
      return { level: label }
    },
  },
})

export default logger
export const apiLogger = logger.child({ module: "api" })
export const authLogger = logger.child({ module: "auth" })
export const aiLogger = logger.child({ module: "ai" })
export const stripeLogger = logger.child({ module: "stripe" })
export const dbLogger = logger.child({ module: "db" })
