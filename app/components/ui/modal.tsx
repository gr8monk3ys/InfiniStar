"use client"

import React, { useEffect, useEffectEvent } from "react"

interface ModalProps {
  isOpen?: boolean
  onClose: () => void
  children: React.ReactNode
  /** Accessible name for the dialog, e.g. the modal's visible title. */
  ariaLabel?: string
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children, ariaLabel }) => {
  const handleEscape = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === "Escape") onClose()
  })

  // Escape closes the dialog, as every other modal in the app does.
  useEffect(() => {
    if (!isOpen) return
    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overflow-x-hidden overscroll-contain bg-scrim/70"
    >
      <div className="relative mx-auto my-6 w-full max-w-lg p-4">
        <div className="relative flex w-full flex-col rounded-lg border-0 bg-white shadow-lg">
          {children}
        </div>
      </div>
    </div>
  )
}

export default Modal
