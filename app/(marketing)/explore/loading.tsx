const FILTER_KEYS = ["filter-1", "filter-2", "filter-3", "filter-4", "filter-5"]
const CARD_KEYS = Array.from({ length: 12 }, (_, i) => `card-${i + 1}`)

export default function ExploreLoading() {
  return (
    <section
      className="container py-8 md:py-12 lg:py-16"
      aria-busy="true"
      aria-label="Loading characters"
    >
      <div className="space-y-8">
        <div className="space-y-3">
          <div className="h-9 w-64 animate-pulse rounded-lg bg-muted" />
          <div className="h-5 w-96 max-w-full animate-pulse rounded bg-muted" />
        </div>
        <div className="flex gap-2">
          {FILTER_KEYS.map((key) => (
            <div key={key} className="h-9 w-24 animate-pulse rounded-full bg-muted" />
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {CARD_KEYS.map((key) => (
            <div key={key} className="space-y-3 rounded-xl border border-border p-4">
              <div className="h-40 animate-pulse rounded-lg bg-muted" />
              <div className="h-5 w-3/4 animate-pulse rounded bg-muted" />
              <div className="h-4 w-full animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
