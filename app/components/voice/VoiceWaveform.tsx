"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { cn } from "@/app/lib/utils"
import type { VoiceInputState } from "@/app/hooks/useVoiceInput"

/**
 * Props for the VoiceWaveform component
 */
export interface VoiceWaveformProps {
  /** Current voice input state */
  state: VoiceInputState
  /** Number of bars in the waveform */
  barCount?: number
  /** Height of the waveform container */
  height?: number
  /** Width of each bar */
  barWidth?: number
  /** Gap between bars */
  barGap?: number
  /** Color for idle state */
  idleColor?: string
  /** Color for listening state */
  activeColor?: string
  /** Whether to use real audio data (requires microphone access) */
  realAudioEnabled?: boolean
  /** Additional CSS classes */
  className?: string
}

/**
 * VoiceWaveform Component
 *
 * Displays an animated audio waveform visualization that responds to voice input.
 * Can use real microphone audio data or simulated animation.
 *
 * @example
 * ```tsx
 * <VoiceWaveform
 *   state={voiceState}
 *   barCount={5}
 *   height={32}
 *   realAudioEnabled={false}
 * />
 * ```
 */
export function VoiceWaveform({
  state,
  barCount = 5,
  height = 32,
  barWidth = 4,
  barGap = 2,
  idleColor = "bg-muted-foreground",
  activeColor = "bg-red-500",
  realAudioEnabled = false,
  className,
}: VoiceWaveformProps): JSX.Element {
  const [audioLevels, setAudioLevels] = useState<number[]>(Array(barCount).fill(0.2))
  const animationFrameRef = useRef<number | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Generate simulated waveform animation
  const generateSimulatedWaveform = useCallback(() => {
    if (state !== "listening") {
      setAudioLevels(Array(barCount).fill(0.15))
      return
    }

    const animate = () => {
      const newLevels = Array(barCount)
        .fill(0)
        .map(() => {
          // Generate random levels with some smoothing
          return 0.2 + Math.random() * 0.8
        })
      setAudioLevels(newLevels)
      animationFrameRef.current = requestAnimationFrame(animate)
    }

    // Slow down animation to roughly 10fps for performance
    const slowAnimate = () => {
      animate()
      setTimeout(() => {
        if (state === "listening") {
          slowAnimate()
        }
      }, 100)
    }

    slowAnimate()
  }, [state, barCount])

  // Initialize real audio from microphone
  const initializeRealAudio = useCallback(async () => {
    if (state !== "listening") {
      // Cleanup when not listening
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
        audioContextRef.current = null
      }
      setAudioLevels(Array(barCount).fill(0.15))
      return
    }

    try {
      // Get microphone stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // Create audio context and analyser
      const audioContext = new AudioContext()
      audioContextRef.current = audioContext

      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 32 // Small FFT size for fewer frequency bands
      analyserRef.current = analyser

      const source = audioContext.createMediaStreamSource(stream)
      source.connect(analyser)

      const dataArray = new Uint8Array(analyser.frequencyBinCount)

      const updateLevels = () => {
        if (!analyserRef.current || state !== "listening") return

        analyserRef.current.getByteFrequencyData(dataArray)

        // Map frequency data to bar count
        const step = Math.floor(dataArray.length / barCount)
        const newLevels = Array(barCount)
          .fill(0)
          .map((_, i) => {
            const start = i * step
            const end = start + step
            let sum = 0
            for (let j = start; j < end && j < dataArray.length; j++) {
              sum += dataArray[j]
            }
            // Normalize to 0-1 range with minimum height
            return Math.max(0.15, (sum / step / 255) * 1.2)
          })

        setAudioLevels(newLevels)
        animationFrameRef.current = requestAnimationFrame(updateLevels)
      }

      updateLevels()
    } catch (err) {
      console.error("Failed to access microphone for waveform:", err)
      // Fall back to simulated waveform
      generateSimulatedWaveform()
    }
  }, [state, barCount, generateSimulatedWaveform])

  // Initialize waveform based on mode
  useEffect(() => {
    if (realAudioEnabled) {
      initializeRealAudio()
    } else {
      generateSimulatedWaveform()
    }

    return () => {
      // Cleanup animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      // Cleanup audio resources
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [realAudioEnabled, initializeRealAudio, generateSimulatedWaveform])

  // Calculate total width
  const totalWidth = barCount * barWidth + (barCount - 1) * barGap

  return (
    <div
      className={cn("flex items-center justify-center gap-[2px]", className)}
      style={{ width: totalWidth, height }}
      role="img"
      aria-label={state === "listening" ? "Audio waveform - recording" : "Audio waveform - idle"}
      aria-live="polite"
    >
      {audioLevels.map((level, index) => (
        <div
          // eslint-disable-next-line react/no-array-index-key -- Waveform bars are visual elements without unique IDs
          key={`waveform-bar-${index}`}
          className={cn(
            "rounded-full transition-all duration-100",
            state === "listening" ? activeColor : idleColor
          )}
          style={{
            width: barWidth,
            height: `${Math.max(20, level * 100)}%`,
            minHeight: 4,
            transitionProperty: "height, background-color",
          }}
          aria-hidden="true"
        />
      ))}
    </div>
  )
}

/**
 * Minimal waveform indicator with three dots
 */
export function VoiceWaveformDots({
  state,
  className,
}: {
  state: VoiceInputState
  className?: string
}): JSX.Element {
  return (
    <div
      className={cn("flex items-center gap-1", className)}
      role="img"
      aria-label={state === "listening" ? "Recording in progress" : "Ready to record"}
    >
      {[0, 1, 2].map((index) => (
        <div
          key={`waveform-dot-${index}`}
          className={cn(
            "size-2 rounded-full transition-all duration-300",
            state === "listening" ? "animate-pulse bg-red-500" : "bg-muted-foreground",
            state === "listening" && index === 1 && "animation-delay-150",
            state === "listening" && index === 2 && "animation-delay-300"
          )}
          style={{
            animationDelay: state === "listening" ? `${index * 150}ms` : "0ms",
          }}
          aria-hidden="true"
        />
      ))}
    </div>
  )
}

export default VoiceWaveform
