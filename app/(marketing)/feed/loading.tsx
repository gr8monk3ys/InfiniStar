const SECTION_KEYS = ["section-trending", "section-new"]
const CARD_KEYS = ["card-1", "card-2", "card-3", "card-4"]

export default function FeedLoading() {
  return (
    <section
      className="container py-8 md:py-12 lg:py-16"
      aria-busy="true"
      aria-label="Loading community feed"
    >
      <div className="space-y-10">
        <div className="space-y-3">
          <div className="h-9 w-72 animate-pulse rounded-lg bg-muted" />
          <div className="h-5 w-96 max-w-full animate-pulse rounded bg-muted" />
        </div>
        {SECTION_KEYS.map((sectionKey) => (
          <div key={sectionKey} className="space-y-4">
            <div className="h-7 w-48 animate-pulse rounded bg-muted" />
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {CARD_KEYS.map((cardKey) => (
                <div
                  key={`${sectionKey}-${cardKey}`}
                  className="space-y-3 rounded-xl border border-border p-4"
                >
                  <div className="h-40 animate-pulse rounded-lg bg-muted" />
                  <div className="h-5 w-3/4 animate-pulse rounded bg-muted" />
                  <div className="h-4 w-full animate-pulse rounded bg-muted" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
