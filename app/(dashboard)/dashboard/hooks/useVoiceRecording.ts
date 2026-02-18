"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import axios from "axios"
import toast from "react-hot-toast"

interface UseVoiceRecordingParams {
  conversationId: string
  csrfToken: string | null
  isAI: boolean
  enableStreaming: boolean
  sendStreamingMessage: (payload: { message?: string; audioUrl?: string }) => Promise<boolean>
}

interface UseVoiceRecordingReturn {
  isRecordingVoiceMessage: boolean
  isSendingVoiceMessage: boolean
  voiceMessageSupported: boolean
  toggleVoiceMessageRecording: () => Promise<void>
}

export default function useVoiceRecording({
  conversationId,
  csrfToken,
  isAI,
  enableStreaming,
  sendStreamingMessage,
}: UseVoiceRecordingParams): UseVoiceRecordingReturn {
  const [isRecordingVoiceMessage, setIsRecordingVoiceMessage] = useState(false)
  const [isSendingVoiceMessage, setIsSendingVoiceMessage] = useState(false)

  const voiceRecorderRef = useRef<MediaRecorder | null>(null)
  const voiceRecorderStreamRef = useRef<MediaStream | null>(null)
  const voiceChunksRef = useRef<Blob[]>([])

  const voiceMessageSupported =
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== "undefined"

  const cleanupVoiceRecorder = useCallback(() => {
    const recorder = voiceRecorderRef.current
    if (recorder) {
      recorder.onstop = null
      try {
        recorder.stop()
      } catch {
        // ignore
      }
    }
    voiceRecorderRef.current = null

    const stream = voiceRecorderStreamRef.current
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
    }
    voiceRecorderStreamRef.current = null
    voiceChunksRef.current = []
    setIsRecordingVoiceMessage(false)
  }, [])

  const handleVoiceMessageStop = useCallback(
    async (mimeType: string) => {
      if (!csrfToken) {
        toast.error("Security token not available. Please refresh the page.")
        cleanupVoiceRecorder()
        return
      }

      const chunks = voiceChunksRef.current
      voiceChunksRef.current = []

      const stream = voiceRecorderStreamRef.current
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
      }
      voiceRecorderStreamRef.current = null
      voiceRecorderRef.current = null

      const blob = new Blob(chunks, { type: mimeType || "audio/webm" })
      if (blob.size < 1024) {
        toast.error("Voice message too short")
        return
      }

      setIsSendingVoiceMessage(true)
      const loader = toast.loading("Sending voice message...")

      try {
        const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
        const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? "pgc9ehd5"
        if (!cloudName) {
          throw new Error("Cloudinary not configured")
        }

        const uploadForm = new FormData()
        uploadForm.append("file", blob, "voice-message.webm")
        uploadForm.append("upload_preset", uploadPreset)
        uploadForm.append("folder", "infinistar/voice")

        const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/video/upload`, {
          method: "POST",
          body: uploadForm,
        })
        const uploadJson = (await uploadRes.json().catch(() => null)) as {
          secure_url?: string
          url?: string
          error?: { message?: string }
        } | null

        const audioUrl = uploadJson?.secure_url ?? uploadJson?.url ?? null
        if (!uploadRes.ok || !audioUrl) {
          throw new Error(uploadJson?.error?.message || "Failed to upload voice message")
        }

        let transcript = ""
        try {
          const txRes = await fetch("/api/ai/transcribe", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-CSRF-Token": csrfToken,
            },
            body: JSON.stringify({ conversationId, audioUrl }),
          })
          if (txRes.ok) {
            const txJson = (await txRes.json().catch(() => null)) as {
              transcript?: string
            } | null
            transcript = typeof txJson?.transcript === "string" ? txJson.transcript : ""
          }
        } catch {
          // best-effort; audio messages can still be sent without transcript
        }

        const headers = {
          "X-CSRF-Token": csrfToken,
          "Content-Type": "application/json",
        }

        const transcriptTrimmed = transcript.trim()

        if (isAI) {
          if (transcriptTrimmed) {
            if (enableStreaming) {
              await sendStreamingMessage({ message: transcriptTrimmed, audioUrl })
            } else {
              await axios.post(
                "/api/ai/chat",
                { message: transcriptTrimmed, audioUrl, conversationId },
                { headers }
              )
            }
          } else {
            await axios.post("/api/messages", { audioUrl, conversationId }, { headers })
          }
        } else {
          await axios.post(
            "/api/messages",
            {
              message: transcriptTrimmed || undefined,
              audioUrl,
              audioTranscript: transcriptTrimmed || undefined,
              conversationId,
            },
            { headers }
          )
        }

        toast.success(
          transcriptTrimmed ? "Voice message sent" : "Voice message sent (no transcript)"
        )
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to send voice message")
      } finally {
        toast.dismiss(loader)
        setIsSendingVoiceMessage(false)
      }
    },
    [cleanupVoiceRecorder, conversationId, csrfToken, enableStreaming, isAI, sendStreamingMessage]
  )

  const toggleVoiceMessageRecording = useCallback(async () => {
    if (isSendingVoiceMessage) return

    if (isRecordingVoiceMessage) {
      try {
        voiceRecorderRef.current?.stop()
      } catch {
        cleanupVoiceRecorder()
      }
      setIsRecordingVoiceMessage(false)
      return
    }

    if (typeof window === "undefined") return

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      toast.error("Voice messages are not supported in this browser.")
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      voiceRecorderStreamRef.current = stream
      voiceChunksRef.current = []

      const recorder = new MediaRecorder(stream)
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          voiceChunksRef.current.push(event.data)
        }
      }
      recorder.onstop = () => {
        handleVoiceMessageStop(recorder.mimeType).catch(() => {
          // handled in function
        })
      }

      voiceRecorderRef.current = recorder
      recorder.start()
      setIsRecordingVoiceMessage(true)
      toast.success("Recording voice message...")
    } catch {
      toast.error("Microphone permission denied")
      cleanupVoiceRecorder()
    }
  }, [cleanupVoiceRecorder, handleVoiceMessageStop, isRecordingVoiceMessage, isSendingVoiceMessage])

  useEffect(() => {
    return () => {
      cleanupVoiceRecorder()
    }
  }, [cleanupVoiceRecorder])

  return {
    isRecordingVoiceMessage,
    isSendingVoiceMessage,
    voiceMessageSupported,
    toggleVoiceMessageRecording,
  }
}
