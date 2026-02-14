import { useEffect, useRef } from "react"
import { useAuth } from "@clerk/nextjs"
import axios from "axios"

import { useCsrfToken } from "@/app/hooks/useCsrfToken"

// Track user activity and update presence status
export default function usePresence() {
  const { userId } = useAuth()
  const { token: csrfToken } = useCsrfToken()
  const awayTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isActiveRef = useRef(true)

  useEffect(() => {
    if (!userId || !csrfToken) return

    const headers = { "X-CSRF-Token": csrfToken }

    // Update presence to online when component mounts
    const setOnline = async () => {
      try {
        await axios.patch("/api/users/presence", { status: "online" }, { headers })
      } catch (error) {
        console.error("Failed to set online status:", error)
      }
    }

    // Update presence to offline when component unmounts or page is hidden
    const setOffline = async () => {
      try {
        await axios.patch("/api/users/presence", { status: "offline" }, { headers })
      } catch (error) {
        console.error("Failed to set offline status:", error)
      }
    }

    // Update presence to away after inactivity
    const setAway = async () => {
      try {
        await axios.patch("/api/users/presence", { status: "away" }, { headers })
        isActiveRef.current = false
      } catch (error) {
        console.error("Failed to set away status:", error)
      }
    }

    // Reset away timer and set back to online if was away
    const resetAwayTimer = async () => {
      if (awayTimeoutRef.current) {
        clearTimeout(awayTimeoutRef.current)
      }

      // If was away, set back to online
      if (!isActiveRef.current) {
        try {
          await axios.patch("/api/users/presence", { status: "online" }, { headers })
          isActiveRef.current = true
        } catch (error) {
          console.error("Failed to set online status:", error)
        }
      }

      // Set timer for 5 minutes of inactivity
      awayTimeoutRef.current = setTimeout(
        () => {
          setAway()
        },
        5 * 60 * 1000
      ) // 5 minutes
    }

    // Activity event handlers
    const activityEvents = ["mousedown", "keydown", "scroll", "touchstart"]

    const handleActivity = () => {
      resetAwayTimer()
    }

    // Handle page visibility change
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setOffline()
        if (awayTimeoutRef.current) {
          clearTimeout(awayTimeoutRef.current)
        }
      } else {
        setOnline()
        resetAwayTimer()
      }
    }

    // Set online on mount
    setOnline()
    resetAwayTimer()

    // Add event listeners
    activityEvents.forEach((event) => {
      window.addEventListener(event, handleActivity)
    })
    document.addEventListener("visibilitychange", handleVisibilityChange)

    // Cleanup
    return () => {
      setOffline()
      if (awayTimeoutRef.current) {
        clearTimeout(awayTimeoutRef.current)
      }
      activityEvents.forEach((event) => {
        window.removeEventListener(event, handleActivity)
      })
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [userId, csrfToken])
}
