import { env } from "@/env.mjs"
import Stripe from "stripe"

export const stripe = new Stripe(process.env.STRIPE_API_KEY!, {
  apiVersion: "2024-11-20.acacia",
  typescript: true,
})
