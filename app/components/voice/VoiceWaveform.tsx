"use client"

import { useEffect, useRef, type ReactElement } from "react"

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
/** Resting bar height (fraction of full height) when not listening. */
const IDLE_LEVEL = 0.2
/** Steady height used instead of the random animation under reduced motion. */
const REDUCED_MOTION_LEVEL = 0.6
/** The simulated waveform refreshes at roughly 10fps. */
const SIMULATED_FRAME_MS = 100

function toScale(level: number): string {
  return `scaleY(${Math.max(IDLE_LEVEL, Math.min(level, 1))})`
}

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
}: VoiceWaveformProps): ReactElement {
  // Bar heights change up to 60 times a second. They are written straight to the
  // bars' transforms through refs, so the component does not re-render per frame.
  const barRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    const setBar = (index: number, level: number) => {
      const bar = barRefs.current[index]
      if (bar) bar.style.transform = toScale(level)
    }
    const setAllBars = (level: number) => {
      for (let i = 0; i < barCount; i++) setBar(i, level)
    }

    if (state !== "listening") {
      setAllBars(IDLE_LEVEL)
      return
    }

    let cancelled = false
    let frameId: number | null = null
    let timerId: ReturnType<typeof setTimeout> | null = null
    let stream: MediaStream | null = null
    let audioContext: AudioContext | null = null

    const runSimulated = () => {
      // A decorative loop: under reduced motion, hold the bars still instead.
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setAllBars(REDUCED_MOTION_LEVEL)
        return
      }
      const tick = () => {
        if (cancelled) return
        for (let i = 0; i < barCount; i++) setBar(i, 0.2 + Math.random() * 0.8)
        timerId = setTimeout(tick, SIMULATED_FRAME_MS)
      }
      tick()
    }

    const runRealAudio = async () => {
      try {
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
        if (cancelled) {
          micStream.getTracks().forEach((track) => track.stop())
          return
        }
        stream = micStream

        const context = new AudioContext()
        audioContext = context

        const analyser = context.createAnalyser()
        analyser.fftSize = 32 // Small FFT size for fewer frequency bands
        context.createMediaStreamSource(micStream).connect(analyser)

        const dataArray = new Uint8Array(analyser.frequencyBinCount)
        const step = Math.floor(dataArray.length / barCount)

        const updateLevels = () => {
          if (cancelled) return
          analyser.getByteFrequencyData(dataArray)

          // Map frequency data to bar count
          for (let i = 0; i < barCount; i++) {
            const start = i * step
            const end = start + step
            let sum = 0
            for (let j = start; j < end && j < dataArray.length; j++) {
              sum += dataArray[j]
            }
            // Normalize to 0-1 range with minimum height
            setBar(i, Math.max(0.15, (sum / step / 255) * 1.2))
          }

          frameId = requestAnimationFrame(updateLevels)
        }

        updateLevels()
      } catch (err) {
        console.error("Failed to access microphone for waveform:", err)
        // Fall back to simulated waveform
        if (!cancelled) runSimulated()
      }
    }

    if (realAudioEnabled) {
      void runRealAudio()
    } else {
      runSimulated()
    }

    return () => {
      cancelled = true
      if (frameId !== null) cancelAnimationFrame(frameId)
      if (timerId !== null) clearTimeout(timerId)
      stream?.getTracks().forEach((track) => track.stop())
      void audioContext?.close()
    }
  }, [state, barCount, realAudioEnabled])

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
      {Array.from({ length: barCount }, (_, index) => (
        <div
          key={`waveform-bar-${index}`}
          ref={(el) => {
            barRefs.current[index] = el
          }}
          className={cn(
            "h-full rounded-full transition-[transform,background-color] duration-100",
            state === "listening" ? activeColor : idleColor
          )}
          style={{ width: barWidth, transform: toScale(IDLE_LEVEL) }}
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
}): ReactElement {
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
            "size-2 rounded-full transition-colors duration-300",
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
