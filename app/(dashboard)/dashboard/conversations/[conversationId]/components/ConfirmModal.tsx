"use client"

import { useCallback, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { toast } from "react-hot-toast"

import { api } from "@/app/lib/api-client"
import { Button } from "@/app/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/app/components/ui/dialog"

interface ConfirmModalProps {
  isOpen?: boolean
  onClose: () => void
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ isOpen, onClose }) => {
  const router = useRouter()
  const params = useParams()
  const { conversationId } = params
  const [isLoading, setIsLoading] = useState(false)

  const onDelete = useCallback(() => {
    setIsLoading(true)

    api
      .delete(`/api/conversations/${conversationId}`, { showErrorToast: false })
      .then(() => {
        onClose()
        router.push("/dashboard/conversations")
        router.refresh()
      })
      .catch(() => toast.error("Couldn't delete the conversation. Try again."))
      .finally(() => setIsLoading(false))
  }, [router, conversationId, onClose])

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <div className="sm:flex sm:items-start">
          <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
            <DialogTitle className="text-base font-semibold leading-6 text-foreground">
              Delete Conversation
            </DialogTitle>
            <div className="mt-2">
              <DialogDescription className="text-sm text-muted-foreground">
                Are you sure you want to delete this conversation? This action cannot be undone.
              </DialogDescription>
            </div>
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-2 sm:mt-4 sm:flex-row-reverse">
          <Button type="button" variant="destructive" disabled={isLoading} onClick={onDelete}>
            {isLoading ? "Deleting…" : "Delete Conversation"}
          </Button>
          <Button type="button" variant="ghost" disabled={isLoading} onClick={onClose}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default ConfirmModal
