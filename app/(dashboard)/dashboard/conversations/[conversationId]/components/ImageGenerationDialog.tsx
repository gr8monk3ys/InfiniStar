"use client"

import { Button } from "@/app/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog"

export type ImageSize = "512x512" | "1024x1024" | "1024x1792" | "1792x1024"

export interface ImageGenerationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  prompt: string
  size: ImageSize
  onPromptChange: (value: string) => void
  onSizeChange: (value: ImageSize) => void
  onGenerate: () => void
  isGenerating: boolean
  isStreaming: boolean
}

export function ImageGenerationDialog({
  open,
  onOpenChange,
  prompt,
  size,
  onPromptChange,
  onSizeChange,
  onGenerate,
  isGenerating,
  isStreaming,
}: ImageGenerationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate image</DialogTitle>
          <DialogDescription>
            Creates an AI-generated image and sends it to this conversation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <label className="block text-sm font-medium text-foreground" htmlFor="image-prompt">
            Prompt
          </label>
          <textarea
            id="image-prompt"
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            placeholder="Describe the image you want..."
            className="min-h-28 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            maxLength={2000}
            disabled={isGenerating || isStreaming}
          />

          <label className="block text-sm font-medium text-foreground" htmlFor="image-size">
            Size
          </label>
          <select
            id="image-size"
            value={size}
            onChange={(e) => onSizeChange(e.target.value as ImageSize)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            disabled={isGenerating || isStreaming}
          >
            <option value="512x512">512x512</option>
            <option value="1024x1024">1024x1024</option>
            <option value="1024x1792">1024x1792</option>
            <option value="1792x1024">1792x1024</option>
          </select>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isGenerating}
          >
            Cancel
          </Button>
          <Button type="button" onClick={onGenerate} disabled={isGenerating || isStreaming}>
            {isGenerating ? "Generating..." : "Generate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
