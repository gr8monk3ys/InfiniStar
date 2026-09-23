import { Suspense } from "react"

import { checkUserDeletionStatus } from "@/app/lib/account-deletion"
import getCurrentUser from "@/app/actions/getCurrentUser"

import ProfilePageClient from "./ProfilePageClient"

export default async function ProfilePage() {
  const currentUser = await getCurrentUser()
  const deletionStatus = currentUser?.id
    ? await checkUserDeletionStatus(currentUser.id)
    : {
        isScheduledForDeletion: false,
      }

  // ProfilePageClient reads the active tab from useSearchParams, which needs a
  // Suspense boundary above it.
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <ProfilePageClient hasPendingDeletion={deletionStatus.isScheduledForDeletion} />
    </Suspense>
  )
}
