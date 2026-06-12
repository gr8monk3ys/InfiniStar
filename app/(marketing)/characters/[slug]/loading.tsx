export default function CharacterLoading() {
  return (
    <section className="container py-8 md:py-12" aria-busy="true" aria-label="Loading character">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="size-28 shrink-0 animate-pulse rounded-full bg-muted" />
          <div className="w-full space-y-3">
            <div className="h-8 w-56 animate-pulse rounded-lg bg-muted" />
            <div className="h-5 w-80 max-w-full animate-pulse rounded bg-muted" />
            <div className="flex gap-2">
              <div className="h-9 w-28 animate-pulse rounded-lg bg-muted" />
              <div className="h-9 w-24 animate-pulse rounded-lg bg-muted" />
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
        </div>
      </div>
    </section>
  )
}
