"use client"

interface MessageEditFormProps {
  value: string
  onChange: (value: string) => void
  onSave: () => Promise<void>
  onCancel: () => void
}

export default function MessageEditForm({
  value,
  onChange,
  onSave,
  onCancel,
}: MessageEditFormProps) {
  return (
    <div className="flex w-full flex-col gap-2">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Edit message"
        className="w-full rounded-lg border border-border bg-background p-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        rows={3}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            void onSave()
          }
          if (e.key === "Escape") {
            onCancel()
          }
        }}
      />
      <div className="flex gap-2">
        <button
          onClick={onSave}
          className="rounded-lg bg-primary px-3 py-1 text-sm text-primary-foreground hover:bg-primary/90"
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="rounded border border-border px-3 py-1 text-sm text-secondary-foreground hover:bg-accent"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
