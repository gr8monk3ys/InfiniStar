"use client"

import { useCallback, useState } from "react"
import toast from "react-hot-toast"

type ImageGenSize = "512x512" | "1024x1024" | "1024x1792" | "1792x1024"

interface UseImageGenerationParams {
  conversationId: string
  csrfToken: string | null
}

interface UseImageGenerationReturn {
  isGeneratingImage: boolean
  imageGenOpen: boolean
  imageGenPrompt: string
  imageGenSize: ImageGenSize
  setImageGenOpen: (open: boolean) => void
  setImageGenPrompt: (prompt: string) => void
  setImageGenSize: (size: ImageGenSize) => void
  handleGenerateImage: () => Promise<void>
}

export default function useImageGeneration({
  conversationId,
  csrfToken,
}: UseImageGenerationParams): UseImageGenerationReturn {
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  const [imageGenOpen, setImageGenOpen] = useState(false)
  const [imageGenPrompt, setImageGenPrompt] = useState("")
  const [imageGenSize, setImageGenSize] = useState<ImageGenSize>("1024x1024")

  const handleGenerateImage = useCallback(async () => {
    if (!csrfToken) {
      toast.error("Security token not available. Please refresh the page.")
      return
    }

    const prompt = imageGenPrompt.trim()
    if (!prompt) {
      toast.error("Enter an image prompt first")
      return
    }

    setIsGeneratingImage(true)
    const loader = toast.loading("Generating image...")

    try {
      const res = await fetch("/api/ai/image/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        body: JSON.stringify({ conversationId, prompt, size: imageGenSize }),
      })

      const data = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) {
        throw new Error(data?.error || "Failed to generate image")
      }

      toast.success("Image sent")
      setImageGenOpen(false)
      setImageGenPrompt("")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate image")
    } finally {
      toast.dismiss(loader)
      setIsGeneratingImage(false)
    }
  }, [conversationId, csrfToken, imageGenPrompt, imageGenSize])

  return {
    isGeneratingImage,
    imageGenOpen,
    imageGenPrompt,
    imageGenSize,
    setImageGenOpen,
    setImageGenPrompt,
    setImageGenSize,
    handleGenerateImage,
  }
}
