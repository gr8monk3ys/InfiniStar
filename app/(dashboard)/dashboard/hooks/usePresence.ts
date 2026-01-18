import { useEffect, useRef } from "react"
import axios from "axios"
import { useSession } from "next-auth/react"

// Track user activity and update presence status
export default function usePresence() {
  const { data: session } = useSession()
  const awayTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isActiveRef = useRef(true)

  useEffect(() => {
    if (!session?.user?.id) return

    // Update presence to online when component mounts
    const setOnline = async () => {
      try {
        await axios.patch("/api/users/presence", {
          status: "online",
        })
      } catch (error) {
        console.error("Failed to set online status:", error)
      }
    }

    // Update presence to offline when component unmounts or page is hidden
    const setOffline = async () => {
      try {
        await axios.patch("/api/users/presence", {
          status: "offline",
        })
      } catch (error) {
        console.error("Failed to set offline status:", error)
      }
    }

    // Update presence to away after inactivity
    const setAway = async () => {
      try {
        await axios.patch("/api/users/presence", {
          status: "away",
        })
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
          await axios.patch("/api/users/presence", {
            status: "online",
          })
          isActiveRef.current = true
        } catch (error) {
          console.error("Failed to set online status:", error)
        }
      }

      // Set timer for 5 minutes of inactivity
      awayTimeoutRef.current = setTimeout(() => {
        setAway()
      }, 5 * 60 * 1000) // 5 minutes
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
  }, [session?.user?.id])
}
