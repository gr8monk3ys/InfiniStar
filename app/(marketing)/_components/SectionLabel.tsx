export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-violet-700 dark:text-violet-300">
      <span className="h-px w-6 bg-current" aria-hidden="true" />
      {children}
    </p>
  )
}
