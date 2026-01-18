import { getServerSession } from "next-auth"

import { authOptions } from "@/app/lib/auth"

export default async function getSession() {
  return await getServerSession(authOptions)
}
