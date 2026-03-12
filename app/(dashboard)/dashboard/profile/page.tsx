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

  return <ProfilePageClient hasPendingDeletion={deletionStatus.isScheduledForDeletion} />
}
